import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Globe, Loader2, Pencil, Send, Share2, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/hooks/use-me";
import { useBannerUpload } from "@/hooks/use-banner-upload";
import { fetchGuests, qk, type Host } from "@/lib/api";
import { absoluteUrl } from "@/lib/image";
import { normalizeUrl } from "@/lib/format";
import { forgetReturning, getPrefs, requestStartHost, updatePrefs, usePrefs } from "@/lib/prefs";
import { BannerLoop } from "./BannerLoop";
import { ImageCanvas, type ImageCanvasHandle } from "./ImageCanvas";

interface Base {
  host: Host;
  open: boolean;
  onClose: () => void;
}

function useLoopImages(host: Host, enabled: boolean) {
  const guests = useQuery({ queryKey: qk.guests(host.id), queryFn: () => fetchGuests(host.id), enabled });
  return [{ src: host.image_url, alt: host.name }, ...(guests.data ?? []).map((g) => ({ src: g.image_url, alt: g.name }))];
}

function invalidateHost(qc: ReturnType<typeof useQueryClient>, host: Host) {
  return Promise.all([
    qc.invalidateQueries({ queryKey: ["host"] }),
    qc.invalidateQueries({ queryKey: qk.home }),
    qc.invalidateQueries({ queryKey: qk.guests(host.id) }),
    qc.invalidateQueries({ queryKey: qk.slotStats(host.id) }),
    qc.invalidateQueries({ queryKey: qk.invitations(host.id) }),
    qc.invalidateQueries({ queryKey: ["relation"] }),
    qc.invalidateQueries({ queryKey: ["me"] }),
  ]);
}

export function LinkDialog({ host, open, onClose, isOwner }: Base & { isOwner: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(host.destination_url ?? "");
  const [busy, setBusy] = useState(false);
  const page = useHostPage(host.id, open && isOwner);
  const active = !!page.data?.active;

  const togglePage = async () => {
    setBusy(true);
    try {
      const { data: slug, error } = await supabase.rpc("ensure_host_page", { p_host: host.id });
      if (error || !slug) throw new Error("Could not open your webpage");
      const { error: upErr } = await supabase.from("static_pages").update({ active: !active }).eq("host_id", host.id);
      if (upErr) throw upErr;
      await qc.invalidateQueries({ queryKey: hostPageKey(host.id) });
      toast.success(active ? "Your own link is used again" : "Your given webpage is now your banner's link");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  const openPage = async () => {
    const slug = page.data?.slug ?? (await supabase.rpc("ensure_host_page", { p_host: host.id })).data;
    if (!slug) return toast.error("Could not open your webpage");
    await qc.invalidateQueries({ queryKey: hostPageKey(host.id) });
    onClose();
    window.location.assign(`/${slug}`);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Visit my Webpage</DialogTitle>
        </DialogHeader>
        {isOwner && (
          <div className="space-y-2">
            <button
              type="button"
              disabled={busy}
              aria-pressed={active}
              onClick={() => void togglePage()}
              className={cn(
                "press flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors",
                active ? "border-gold bg-gold-soft text-gold" : "border-border text-muted-foreground hover:border-gold/40",
              )}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span className="flex-1 leading-snug">
                <b className={cn("block", active ? "text-gold" : "text-foreground")}>Set an external link to your banner</b>
                Activate your given webpage or set up your own link
              </span>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className={cn("h-3 w-3 shrink-0 rounded-full", active ? "bg-gold" : "bg-muted")} />}
            </button>
            <Button variant="outline" className="w-full" onClick={() => void openPage()}>
              <FileText /> {page.data ? "Open my webpage" : "Create my webpage"}
            </Button>
          </div>
        )}
        {host.destination_url && !active && (
          <Button asChild variant="gold">
            <a href={host.destination_url} target="_blank" rel="noopener noreferrer">
              <Globe /> Visit my Webpage
            </a>
          </Button>
        )}
        {isOwner &&
          !active &&
          (editing ? (
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const { error } = await supabase
                  .from("hosts")
                  .update({ destination_url: normalizeUrl(url) || null })
                  .eq("id", host.id);
                if (error) return toast.error(error.message);
                await invalidateHost(qc, host);
                setEditing(false);
                toast.success("Link saved");
              }}
            >
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-site.com" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
              <Button type="submit" size="icon" aria-label="Save link">
                <Check />
              </Button>
            </form>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> {host.destination_url ? "Edit my own link" : "Set up my own link"}
            </Button>
          ))}
      </DialogContent>
    </Dialog>
  );
}

export function SpyDialog({ host, open, onClose, isOwner }: Base & { isOwner: boolean }) {
  const { user } = useMe();
  const prefs = usePrefs();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const images = useLoopImages(host, open);
  const mySpy = useQuery({
    queryKey: ["spying", host.id, user?.id ?? null],
    enabled: open && !!user && !isOwner,
    queryFn: async () => {
      const { data } = await supabase.from("spies").select("id").eq("host_id", host.id).maybeSingle();
      return !!data;
    },
  });
  const spying = user ? !!mySpy.data : !!prefs.spying[host.id];

  if (isOwner) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{host.auto_spy_guests ? "Stop to Spy my Guests" : "Auto Spy all my Guests"}</DialogTitle>
            <DialogDescription>Get an email with a preview whenever one of your guests changes their banner.</DialogDescription>
          </DialogHeader>
          <BannerLoop images={images} />
          <label className="flex items-center justify-between rounded-lg border p-3 text-sm">
            {host.auto_spy_guests ? "Stop to Spy my Guests" : "Auto Spy all my Guests"}
            <Switch
              checked={host.auto_spy_guests}
              onCheckedChange={async (v) => {
                const { error } = await supabase.from("hosts").update({ auto_spy_guests: v }).eq("id", host.id);
                if (error) return toast.error(error.message);
                await invalidateHost(qc, host);
              }}
            />
          </label>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">{spying ? <span className="text-gold">Spy</span> : "Spy on this host for updates"}</DialogTitle>
          <DialogDescription>
            {spying
              ? "You'll get an email preview whenever this Host changes their banner or welcomes new guests."
              : "Receive automatic alerts with a preview of the new banner when this Host's banner or guests change."}
          </DialogDescription>
        </DialogHeader>
        {spying ? (
          <>
            <BannerLoop images={images} />
            <Button
              variant="outline"
              onClick={async () => {
                await supabase.rpc("stop_spy", { p_host: host.id, p_email: prefs.spying[host.id] ?? "" });
                updatePrefs((p) => {
                  const s = { ...p.spying };
                  delete s[host.id];
                  return { spying: s };
                });
                await qc.invalidateQueries({ queryKey: ["spying", host.id] });
                await invalidateHost(qc, host);
                onClose();
              }}
            >
              Stop to Spy
            </Button>
          </>
        ) : (
          <form
            className="space-y-2"
            onSubmit={async (e) => {
              e.preventDefault();
              const { data, error } = await supabase.rpc("spy_on", { p_host: host.id, p_email: email });
              if (error || data !== "ok") return toast.error("Enter a valid email");
              if (!user) updatePrefs((p) => ({ spying: { ...p.spying, [host.id]: email.trim().toLowerCase() } }));
              await qc.invalidateQueries({ queryKey: ["spying", host.id] });
              await invalidateHost(qc, host);
              toast.success("You're spying on this Host");
            }}
          >
            {!user && <Input type="email" required placeholder="Your email" value={email} onChange={(e) => setEmail(e.target.value)} />}
            <Button type="submit" variant="gold" className="w-full">
              Spy
            </Button>
          </form>
        )}
        <p className="text-center text-[11px] text-muted-foreground">Email alerts are coming soon — your Spy is saved and will start sending once they launch.</p>
      </DialogContent>
    </Dialog>
  );
}

export function StatsDialog({ host, open, onClose, kind }: Base & { kind: "views" | "stars" | "entries" }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            {kind === "views" ? "Views" : kind === "stars" ? "Shared banner" : "Entry ports"}
          </DialogTitle>
        </DialogHeader>
        {kind === "views" && (
          <p className="text-sm">
            <b className="text-2xl tabular-nums">{host.views.toLocaleString()}</b>
            <br />
            Times this Hostpage was opened, from Hostme or from shared banners.
          </p>
        )}
        {kind === "entries" && (
          <p className="text-sm">
            <b className="text-2xl tabular-nums">{host.entries.toLocaleString()}</b>
            <br />
            Visits that arrived on Hostme through this Host's shared banner.
          </p>
        )}
        {kind === "stars" && (
          <div className="space-y-3 text-sm">
            <p>
              <span className="text-gold">★</span> <b className="text-2xl tabular-nums">{host.stars.toLocaleString()}</b>
              <br />
              Total clicks on Host's shared banners.
            </p>
            <p>
              <span className="text-suggest">✦</span> <b className="text-2xl tabular-nums">{host.sparkles.toLocaleString()}</b>
              <br />
              Total impressions on Host's shared banners.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function InviteDialog({ host, open, onClose }: Base) {
  const { acting, user } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const rel = useQuery({
    queryKey: qk.relation(acting?.id ?? "", host.id),
    enabled: open && !!acting,
    queryFn: async () => {
      const { data } = await supabase.rpc("relation_status", { p_from: acting!.id, p_to: host.id });
      return (data ?? "none") as "none" | "partner" | "pending_out" | "pending_in";
    },
  });

  if (!user || !acting) {
    return (
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Invite as Guest</DialogTitle>
            <DialogDescription>Start your own Host to invite this banner as a guest and swap audiences.</DialogDescription>
          </DialogHeader>
          <Button
            variant="gold"
            onClick={() => {
              onClose();
              requestStartHost();
              navigate({ to: "/" });
            }}
          >
            Start a Host
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  const run = async (fn: () => PromiseLike<{ data: unknown; error: unknown }>, ok: string) => {
    setBusy(true);
    const { data, error } = await fn();
    setBusy(false);
    if (error) return toast.error("Something went wrong");
    const msg: Record<string, string> = {
      full_self: "Your guest slots are full. Free one, buy more slots, or send a message instead.",
      full_target: "This Host's guest slots are full right now — send them a message instead.",
      exists: "An invitation is already waiting.",
      partner: "You're already partners.",
    };
    if (data !== "ok") return toast.error(msg[String(data)] ?? "Not possible right now");
    toast.success(ok);
    await invalidateHost(qc, host);
    await invalidateHost(qc, acting);
    onClose();
  };

  const status = rel.data;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">
            {status === "partner" ? "Say Goodbye" : status === "pending_out" ? "Invitation sent" : "Invite as Guest"}
          </DialogTitle>
          <DialogDescription>
            {status === "partner"
              ? "Remove this guest to free one slot on both pages."
              : status === "pending_out"
                ? "Waiting for this Host to accept."
                : status === "pending_in"
                  ? "This Host invited you. Accept to place each other as guests."
                  : `Invite ${host.name} to swap guest slots with ${acting.name}.`}
          </DialogDescription>
        </DialogHeader>
        {status === "partner" && (
          <Button variant="destructive" disabled={busy} onClick={() => void run(() => supabase.rpc("remove_guest", { p_host: acting.id, p_guest: host.id }), "Guest removed")}>
            Say Goodbye / Remove Guest
          </Button>
        )}
        {status === "pending_out" && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              const { data } = await supabase.rpc("host_invitations", { p_host: acting.id });
              const inv = (data ?? []).find((i) => i.other_id === host.id);
              if (inv) await run(() => supabase.rpc("decline_invite", { p_id: inv.id }), "Invitation cancelled");
            }}
          >
            Cancel invitation
          </Button>
        )}
        {status === "pending_in" && (
          <Button
            variant="gold"
            disabled={busy}
            onClick={async () => {
              const { data } = await supabase.rpc("host_invitations", { p_host: acting.id });
              const inv = (data ?? []).find((i) => i.other_id === host.id);
              if (inv) await run(() => supabase.rpc("accept_invite", { p_id: inv.id }), "Welcome, new partner!");
            }}
          >
            <Check /> Accept
          </Button>
        )}
        {status === "none" && (
          <Button variant="gold" disabled={busy} onClick={() => void run(() => supabase.rpc("send_invite", { p_from: acting.id, p_to: host.id }), "Invitation sent")}>
            <UserPlus /> Invite as Guest
          </Button>
        )}
        {!status && <Loader2 className="mx-auto animate-spin" />}
      </DialogContent>
    </Dialog>
  );
}

export const QUICK_IDEAS = [
  { icon: "🤝", text: "Hi! I saw your page and love your work. Would you like to swap guest slots?" },
  { icon: "🔄", text: "Hey there! I'm open to bartering skills/services. Let's connect!" },
  { icon: "💬", text: "Just dropping by to say hello and share some traffic your way!" },
];

export function MessageDialog({ host, open, onClose }: Base) {
  const { acting, user } = useMe();
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Message {host.name}</DialogTitle>
          <DialogDescription>
            {acting ? `Sent as ${acting.name}. Emails stay private — only names are shown.` : "Your email stays private and lets this Host reply to you."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Quick Ideas</p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_IDEAS.map((q) => (
              <button
                key={q.icon}
                type="button"
                onClick={() => setBody(q.text)}
                className="press rounded-full border bg-muted px-3 py-1 text-left text-xs hover:border-gold/50"
              >
                {q.icon} {q.text.split(/[.!?]/)[0]}
              </button>
            ))}
          </div>
        </div>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const { data, error } =
              user && acting
                ? await supabase.rpc("send_message", { p_from: acting.id, p_to_host: host.id, p_to_messenger: null as unknown as string, p_body: body })
                : await supabase.rpc("send_message_anon", { p_email: email, p_to_host: host.id, p_body: body });
            setBusy(false);
            if (error || data !== "ok") return toast.error(data === "invalid_email" ? "Enter a valid email" : "Could not send");
            toast.success("Message sent");
            setBody("");
            onClose();
          }}
        >
          {!user && <Input type="email" required placeholder="Your email (for replies)" value={email} onChange={(e) => setEmail(e.target.value)} />}
          <Textarea required rows={4} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
          <Button type="submit" variant="gold" className="w-full" disabled={busy}>
            <Send /> Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          type="button"
          size="icon"
          variant="secondary"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setDone(true);
            setTimeout(() => setDone(false), 1500);
          }}
        >
          {done ? <Check /> : <Copy />}
        </Button>
      </div>
    </div>
  );
}

export function ShareDialog({ host, open, onClose }: Base) {
  const images = useLoopImages(host, open);
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const pageUrl = host.is_home ? `${origin}/?src=embed` : `${origin}/${host.slug}?src=embed`;
  const iframe = `<iframe src="${origin}/embed/${host.slug}" title="${host.name} on Hostme" style="border:0;width:100%;max-width:480px;aspect-ratio:16/9;border-radius:12px" loading="lazy"></iframe>`;
  const signature = `<a href="${pageUrl}"><img src="${origin}/api/public/banner/${host.slug}" alt="${host.name}" width="320" height="180" style="border-radius:8px;object-fit:cover"/></a>`;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Share my banner</DialogTitle>
          <DialogDescription>Your shared banner rotates you and your guests live — no need to re-paste when things change.</DialogDescription>
        </DialogHeader>
        <BannerLoop images={images} />
        <CopyRow label="Live embed" value={iframe} />
        <CopyRow label="Email signature" value={signature} />
        <CopyRow label="Social bio link" value={pageUrl} />
        {typeof navigator !== "undefined" && "share" in navigator && (
          <Button
            variant="gold"
            onClick={() => void navigator.share({ title: host.name, text: `${host.name} on Hostme`, url: pageUrl }).catch(() => {})}
          >
            <Share2 /> Share through apps
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ChangeImageDialog({ host, open, onClose }: Base) {
  const { user, me, refresh } = useMe();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const canvas = useRef<ImageCanvasHandle>(null);
  const upload = useBannerUpload();
  const [name, setName] = useState(host.name);
  const [imageChanged, setImageChanged] = useState(false);
  const [confirmImage, setConfirmImage] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (imageChanged && !host.is_home && !confirmImage) {
      setConfirmImage(true);
      return;
    }
    setBusy(true);
    try {
      const patch: { name?: string; image_url?: string } = {};
      if (!host.is_home && name.trim() && name.trim() !== host.name) patch.name = name.trim();
      if (imageChanged) patch.image_url = await upload.run(canvas, user!.id);
      if (Object.keys(patch).length) {
        const { error } = await supabase.from("hosts").update(patch).eq("id", host.id);
        if (error) throw error;
      }
      await invalidateHost(qc, host);
      toast.success("Saved");
      setConfirmImage(false);
      setImageChanged(false);
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  const del = async () => {
    setBusy(true);
    const { data } = await supabase.rpc("delete_host", { p_host: host.id });
    setBusy(false);
    if (data === "blocked") return toast.error("This page holds paid impressions or earnings, so it can't be deleted. You can change its image instead.");
    if (data !== "ok") return toast.error("Could not delete");
    const remaining = (me?.hosts ?? []).filter((h) => h.id !== host.id);
    if (remaining.filter((h) => !h.is_home).length === 0 && me?.email) forgetReturning(me.email);
    const p = getPrefs();
    updatePrefs(() => ({
      lockedHostId: p.lockedHostId === host.id ? null : p.lockedHostId,
      selectedHostId: p.selectedHostId === host.id ? null : p.selectedHostId,
    }));
    refresh();
    toast.success("Host deleted");
    onClose();
    const next = remaining.find((h) => !h.is_home);
    if (next) navigate({ to: "/$slug", params: { slug: next.slug } });
    else navigate({ to: "/" });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Change My Image</DialogTitle>
          <DialogDescription>Tap to choose, drag to reposition, pinch or scroll to resize.</DialogDescription>
        </DialogHeader>
        <ImageCanvas ref={canvas} initialUrl={open ? host.image_url || undefined : undefined} onChange={() => setImageChanged(true)} />
        {!host.is_home && <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Name" />}
        {confirmImage && (
          <p className="rounded-lg bg-destructive/15 p-3 text-sm text-destructive">
            Changing the image will cause all view counts and partners to be lost. Press Save again to confirm.
          </p>
        )}
        <Button variant="gold" disabled={busy || upload.busy} onClick={() => void save()}>
          {busy || upload.busy ? (
            <>
              <Loader2 className="animate-spin" /> {upload.label || "Saving…"}
            </>
          ) : (
            "Save"
          )}
        </Button>
        {!host.is_home && (
          <div className="border-t pt-3">
            {confirmDelete ? (
              <div className="space-y-2">
                <p className="text-sm text-destructive">Every information about this Host will be erased from the database.</p>
                <div className="flex gap-2">
                  <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => void del()}>
                    <Trash2 /> Delete forever
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                    Keep
                  </Button>
                </div>
              </div>
            ) : (
              <button className="press text-xs text-muted-foreground hover:text-destructive" onClick={() => setConfirmDelete(true)}>
                Delete this Host
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
