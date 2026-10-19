import { useState } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, FileText, Lock, LockOpen, LogIn, LogOut, Mail, MessageSquare, Plus, Sparkles, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useMe } from "@/hooks/use-me";
import { useUnread } from "@/hooks/use-unread";
import { emailStatus, sendOtp, type Host } from "@/lib/api";
import { inboxUrl, requestStartHost, updatePrefs, usePrefs } from "@/lib/prefs";
import { usd } from "@/lib/format";
import { PRICES } from "@/lib/slots";
import { STATIC_PAGES } from "@/lib/static-pages";
import { cn } from "@/lib/utils";
import { WaitingEmail } from "./WaitingEmail";
import { TestModeNote } from "./SponsorMenu";

export function UserMenu() {
  const { user, ready } = useMe();
  const unread = useUnread();
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn("press relative inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent", unread > 0 && "text-gold")}
          aria-label="Account"
        >
          <User className="h-5 w-5" />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-gold" />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {!ready ? null : user ? <LoggedIn unread={unread} close={() => setOpen(false)} /> : <LoggedOut close={() => setOpen(false)} />}
      </PopoverContent>
    </Popover>
  );
}

function useGoStart() {
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (email?: string) => {
    requestStartHost(email);
    if (path !== "/") navigate({ to: "/" });
    else document.getElementById("start-host")?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
}

function LoggedOut({ close }: { close: () => void }) {
  const prefs = usePrefs();
  const goStart = useGoStart();
  const [email, setEmail] = useState("");
  const [waiting, setWaiting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const login = async (em: string) => {
    const e = em.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return toast.error("Enter a valid email");
    setBusy(true);
    try {
      if ((await emailStatus(e)) === "none") {
        toast.message("No Hostpage for this email yet — let's start one.");
        close();
        goStart(e);
        return;
      }
      await sendOtp(e);
      setWaiting(e);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  if (waiting) return <WaitingEmail email={waiting} onBack={() => setWaiting(null)} />;

  return (
    <div className="space-y-3">
      <Button
        variant="gold"
        className="w-full"
        onClick={() => {
          close();
          goStart();
        }}
      >
        <Plus /> Start a Host
      </Button>
      {prefs.returning.length > 0 && (
        <div className="space-y-1">
          <p className="px-1 text-[11px] uppercase tracking-wide text-muted-foreground">Welcome back</p>
          {prefs.returning.map((r) => (
            <button
              key={r.email}
              disabled={busy}
              onClick={() => void login(r.email)}
              className="press flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
            >
              <span className="truncate">{r.name}</span>
              <LogIn className="h-4 w-4 text-gold" />
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void login(email);
        }}
      >
        <Input type="email" placeholder="Log in with email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" size="icon" variant="secondary" disabled={busy} aria-label="Log in">
          <LogIn />
        </Button>
      </form>
    </div>
  );
}

function LoggedIn({ unread, close }: { unread: number; close: () => void }) {
  const { me, orderedHosts, user } = useMe();
  const prefs = usePrefs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const goStart = useGoStart();
  const [buyOpen, setBuyOpen] = useState(false);
  const [staticOpen, setStaticOpen] = useState(false);
  const multi = orderedHosts.length > 1;
  const freeSlots = me ? Math.max(0, me.quota - me.ownedPages) : 0;

  const openHost = (h: Host) => {
    if (!prefs.lockedHostId || !multi) updatePrefs(() => ({ selectedHostId: h.id }));
    close();
    if (h.is_home) navigate({ to: "/" });
    else navigate({ to: "/$slug", params: { slug: h.slug } });
  };

  const logout = async () => {
    close();
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  };

  const top = orderedHosts[0];
  const locked = multi && prefs.lockedHostId === top?.id;

  return (
    <div className="space-y-1">
      {orderedHosts.map((h, i) => (
        <div key={h.id} className={cn("flex items-center gap-1 rounded-md", i === 0 && "bg-accent/60")}>
          <button onClick={() => openHost(h)} className="press min-w-0 flex-1 truncate px-3 py-2 text-left text-sm font-medium">
            {h.is_home ? "Hostme (home)" : h.name}
          </button>
          {multi && (me?.balances[h.id] ?? 0) > 0 && (
            <span className="text-xs tabular-nums text-gold">{usd(me!.balances[h.id], 3)}</span>
          )}
          {i === 0 && multi && (
            <button
              onClick={() => updatePrefs(() => ({ lockedHostId: locked ? null : h.id, selectedHostId: h.id }))}
              className={cn("press rounded-md p-1.5", locked ? "text-gold" : "text-muted-foreground")}
              aria-label={locked ? "Unlock page" : "Lock page"}
              title={locked ? "Locked: this page stays your owner view" : "Lock this page as your owner view"}
            >
              {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
            </button>
          )}
          {i === 0 && (
            <button onClick={() => setBuyOpen(true)} className="press ml-auto rounded-md p-1.5 text-gold" aria-label="Add another Host page">
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {Array.from({ length: me?.isAdmin ? 0 : freeSlots }).map((_, i) => (
        <button
          key={`free-${i}`}
          onClick={() => {
            close();
            goStart();
          }}
          className="press flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-gold hover:bg-accent"
        >
          <Sparkles className="h-4 w-4" /> Start a New Host
        </button>
      ))}
      <div className="my-1 h-px bg-border" />
      {me?.isAdmin && (
        <>
          <button
            onClick={() => setStaticOpen((v) => !v)}
            className="press flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
          >
            <FileText className="h-4 w-4" /> Static Pages
            <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", staticOpen && "rotate-180")} />
          </button>
          {staticOpen &&
            STATIC_PAGES.map((p) => (
              <Link
                key={p.key}
                to={p.path}
                onClick={close}
                className="press block rounded-md py-1.5 pl-10 pr-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {p.title}
              </Link>
            ))}
        </>
      )}
      <Link
        to="/messages"
        onClick={close}
        className={cn("press flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent", unread > 0 && "text-gold")}
      >
        <MessageSquare className="h-4 w-4" /> Messages
        {unread > 0 && <span className="ml-auto rounded-full bg-gold px-2 text-xs font-bold text-gold-foreground">{unread}</span>}
      </Link>
      <a
        href={inboxUrl(me?.email ?? user?.email)}
        target="_blank"
        rel="noreferrer"
        className="press flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent"
      >
        <Mail className="h-4 w-4" /> My email
      </a>
      <button onClick={() => void logout()} className="press flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover:bg-accent">
        <LogOut className="h-4 w-4" /> Log out
      </button>
      <BuyPageDialog
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        onReady={() => {
          setBuyOpen(false);
          close();
          goStart();
        }}
      />
    </div>
  );
}

export function BuyPageDialog({ open, onClose, onReady }: { open: boolean; onClose: () => void; onReady: () => void }) {
  const { me, refresh } = useMe();
  const [busy, setBusy] = useState(false);
  const free = me?.isAdmin;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display">Add another Host page</DialogTitle>
          <DialogDescription>
            {free
              ? "As the Hostme owner you can create extra Host pages on your email for free."
              : `Each extra Host page is ${usd(PRICES.extraPage)}, unlocked one at a time and saved forever on your email. If you delete one, you can start it again any time.`}
          </DialogDescription>
        </DialogHeader>
        <Button
          variant="gold"
          disabled={busy}
          onClick={async () => {
            if (free) return onReady();
            setBusy(true);
            const { data, error } = await supabase.rpc("buy_extra_page");
            setBusy(false);
            if (error || data !== "ok") return toast.error(error?.message || "Could not complete");
            refresh();
            toast.success("New Host page unlocked");
            onReady();
          }}
        >
          <Plus /> {free ? "Start a New Host" : `Buy for ${usd(PRICES.extraPage)}`}
        </Button>
        {!free && <TestModeNote />}
      </DialogContent>
    </Dialog>
  );
}
