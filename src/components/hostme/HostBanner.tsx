import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { DoorOpen, Eye, Mail, RefreshCw, Share2, Star, UserPlus, UserSearch } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { qk, type Host } from "@/lib/api";
import { compact } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";
import { Frame169 } from "./Banner";
import { TickingMoney } from "./TickingMoney";
import { ChangeImageDialog, InviteDialog, LinkDialog, MessageDialog, ShareDialog, SpyDialog, StatsDialog } from "./HostDialogs";

type Open = null | "link" | "spy" | "views" | "stars" | "entries" | "invite" | "share" | "message" | "change";

function Chip({ className, onClick, children, label, active }: { className?: string; onClick: () => void; children: ReactNode; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "press absolute z-10 inline-flex items-center gap-1 rounded-full bg-overlay px-2.5 py-1.5 text-xs font-semibold text-overlay-foreground backdrop-blur-md hover:bg-overlay/80 [&_svg]:h-4 [&_svg]:w-4",
        active && "text-gold",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function HostBanner({ host, isOwner }: { host: Host; isOwner: boolean }) {
  const [open, setOpen] = useState<Open>(null);
  const { user, acting, me } = useMe();
  const prefs = usePrefs();
  const close = () => setOpen(null);

  const rel = useQuery({
    queryKey: qk.relation(acting?.id ?? "", host.id),
    enabled: !isOwner && !!acting && acting.id !== host.id,
    queryFn: async () => {
      const { data } = await supabase.rpc("relation_status", { p_from: acting!.id, p_to: host.id });
      return data as string;
    },
  });
  const spyQ = useQuery({
    queryKey: ["spying", host.id, user?.id ?? null],
    enabled: !isOwner && !!user,
    queryFn: async () => {
      const { data } = await supabase.from("spies").select("id").eq("host_id", host.id).maybeSingle();
      return !!data;
    },
  });
  const spying = !isOwner && (user ? !!spyQ.data : !!prefs.spying[host.id]);
  const balance = isOwner ? (me?.balances[host.id] ?? 0) : 0;
  const centerClickable = isOwner || !!host.destination_url;

  return (
    <>
      <Frame169 src={host.image_url} alt={host.name} className="rounded-2xl ring-1 ring-gold/15">
        {centerClickable && (
          <button
            type="button"
            aria-label="Open link"
            onClick={() => setOpen("link")}
            className="absolute left-1/4 top-1/4 h-1/2 w-1/2 cursor-pointer rounded-xl"
          />
        )}
        <Chip className="left-3 top-3" label="Views" onClick={() => setOpen("views")}>
          <Eye /> {compact(host.views)}
        </Chip>
        <Chip className="right-3 top-3" label="Spy" active={spying || (isOwner && host.auto_spy_guests)} onClick={() => setOpen("spy")}>
          <UserSearch /> {compact(host.spies_count)}
        </Chip>
        <Chip className="left-3 top-1/2 -translate-y-1/2" label="Stars" onClick={() => setOpen("stars")}>
          <Star /> {compact(host.stars)}
        </Chip>
        {isOwner ? (
          <Chip className="right-3 top-1/2 -translate-y-1/2" label="Share banner" onClick={() => setOpen("share")}>
            <Share2 />
          </Chip>
        ) : (
          <Chip className="right-3 top-1/2 -translate-y-1/2" label="Invite as Guest" active={rel.data === "partner"} onClick={() => setOpen("invite")}>
            <UserPlus />
          </Chip>
        )}
        <Chip className="bottom-3 left-3" label="Entry ports" onClick={() => setOpen("entries")}>
          <DoorOpen /> {compact(host.entries)}
        </Chip>
        {isOwner ? (
          <Chip className="bottom-3 right-3" label="Change My Image" onClick={() => setOpen("change")}>
            <RefreshCw />
          </Chip>
        ) : (
          <Chip className="bottom-3 right-3" label="Send Message" onClick={() => setOpen("message")}>
            <Mail />
          </Chip>
        )}
      </Frame169>

      <LinkDialog host={host} open={open === "link"} onClose={close} isOwner={isOwner} />
      <SpyDialog host={host} open={open === "spy"} onClose={close} isOwner={isOwner} />
      <StatsDialog host={host} open={open === "views"} onClose={close} kind="views" />
      <StatsDialog host={host} open={open === "stars"} onClose={close} kind="stars" />
      <StatsDialog host={host} open={open === "entries"} onClose={close} kind="entries" />
      {isOwner ? (
        <>
          <ShareDialog host={host} open={open === "share"} onClose={close} />
          <ChangeImageDialog key={host.image_url} host={host} open={open === "change"} onClose={close} />
        </>
      ) : (
        <>
          <InviteDialog host={host} open={open === "invite"} onClose={close} />
          <MessageDialog host={host} open={open === "message"} onClose={close} />
        </>
      )}
    </>
  );
}
