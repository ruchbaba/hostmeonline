import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ImageCanvas, type ImageCanvasHandle } from "./ImageCanvas";
import { WaitingEmail } from "./WaitingEmail";
import { useBannerUpload } from "@/hooks/use-banner-upload";
import { NAME_PROMPTS, useRotating } from "@/hooks/use-rotating";
import { useMe } from "@/hooks/use-me";
import { emailStatus, sendOtp } from "@/lib/api";
import { normalizeUrl } from "@/lib/format";
import { PREFILL_KEY, rememberReturning, updatePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export function StartHostForm({ onNeedPurchase }: { onNeedPurchase?: () => void }) {
  const navigate = useNavigate();
  const { user, me, refresh } = useMe();
  const canvas = useRef<ImageCanvasHandle>(null);
  const upload = useBannerUpload();
  const { item: placeholder } = useRotating(NAME_PROMPTS, 3200);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [taken, setTaken] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);

  useEffect(() => {
    const pre = sessionStorage.getItem(PREFILL_KEY);
    if (pre) {
      setEmail(pre);
      sessionStorage.removeItem(PREFILL_KEY);
    }
    const onStart = (e: Event) => {
      const em = (e as CustomEvent<{ email?: string }>).detail?.email;
      if (em) {
        setEmail(em);
        setTaken(false);
      }
    };
    window.addEventListener("hostme:start", onStart);
    return () => window.removeEventListener("hostme:start", onStart);
  }, []);

  const loggedIn = !!user;

  async function checkEmail(value: string) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim())) return false;
    const st = await emailStatus(value.trim());
    setTaken(st === "host");
    return st === "host";
  }

  async function submit() {
    if (!canvas.current?.hasImage()) return toast.error("Choose a 16:9 banner image first");
    if (!name.trim()) return toast.error("Give your Host a name");
    setBusy(true);
    try {
      if (loggedIn) {
        if (me && !me.isAdmin && me.ownedPages >= me.quota) {
          onNeedPurchase?.();
          toast.message("Add another Host page to continue");
          return;
        }
        const imageUrl = await upload.run(canvas, user!.id);
        const { data: slug, error } = await supabase.rpc("create_host", {
          p_name: name.trim(),
          p_image_url: imageUrl,
          p_destination: normalizeUrl(url),
        });
        if (error || !slug) throw new Error(error?.message === "quota" ? "Add another Host page first" : error?.message || "Could not create");
        const { data: created } = await supabase.from("hosts").select("id").eq("slug", slug).maybeSingle();
        if (created) updatePrefs(() => ({ selectedHostId: created.id }));
        refresh();
        navigate({ to: "/$slug", params: { slug } });
        return;
      }
      const em = email.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast.error("Enter a valid email");
      if (await checkEmail(em)) {
        toast.error("This email already has a Hostpage. Log in from the top-right menu, or use another email.");
        return;
      }
      const imageUrl = await upload.run(canvas, "pending");
      const { data: res, error } = await supabase.rpc("start_signup", {
        p_email: em,
        p_name: name.trim(),
        p_image_url: imageUrl,
        p_destination: normalizeUrl(url),
      });
      if (error) throw error;
      if (res === "taken") {
        setTaken(true);
        return toast.error("This email already has a Hostpage.");
      }
      if (res !== "ok") throw new Error("Please check the form and try again");
      await sendOtp(em);
      rememberReturning({ name: name.trim(), email: em, slug: "" });
      setWaitingFor(em);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (waitingFor) return <WaitingEmail email={waitingFor} onBack={() => setWaitingFor(null)} />;

  const working = busy || upload.busy;

  return (
    <form
      id="start-host-form"
      className="hm-fade-in space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <ImageCanvas ref={canvas} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={placeholder}
        maxLength={60}
        aria-label="Name"
      />
      {!loggedIn && (
        <Input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTaken(false);
          }}
          onBlur={() => void checkEmail(email)}
          placeholder="Email (private)"
          aria-label="Email"
          aria-invalid={taken}
          className={cn(taken && "border-destructive text-destructive")}
        />
      )}
      {taken && !loggedIn && (
        <p className="text-xs text-destructive">This email is already taken. Rewrite it or log in from the top-right menu.</p>
      )}
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Destination URL (optional)" aria-label="Destination URL" />
      <Button type="submit" variant="gold" className="w-full" disabled={working}>
        {working ? (
          <>
            <Loader2 className="animate-spin" /> {upload.label || "Working…"}
          </>
        ) : (
          <>
            Next <ArrowRight />
          </>
        )}
      </Button>
    </form>
  );
}
