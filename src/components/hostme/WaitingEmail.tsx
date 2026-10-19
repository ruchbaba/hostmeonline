import { useState } from "react";
import { Mail, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { inboxUrl } from "@/lib/prefs";
import { sendOtp } from "@/lib/api";

export const WAITING_COPY =
  "Almost there. Check your email and click the confirmation link to log into your Hostme page.";

export function WaitingEmail({ email, onBack }: { email: string; onBack?: () => void }) {
  const [sending, setSending] = useState(false);
  return (
    <div className="hm-fade-in space-y-4 rounded-xl border border-gold/30 bg-gold-soft p-4 text-center">
      <p className="text-sm leading-relaxed">{WAITING_COPY}</p>
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={sending}
          onClick={async () => {
            setSending(true);
            try {
              await sendOtp(email);
              toast.success("Sent again");
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Could not resend");
            } finally {
              setSending(false);
            }
          }}
        >
          <RotateCw className={sending ? "animate-spin" : ""} /> Resend
        </Button>
        <Button asChild variant="gold" size="icon" aria-label="Open my email">
          <a href={inboxUrl(email)} target="_blank" rel="noreferrer">
            <Mail />
          </a>
        </Button>
      </div>
      {onBack && (
        <button className="press text-xs text-muted-foreground underline-offset-4 hover:underline" onClick={onBack}>
          Back
        </button>
      )}
    </div>
  );
}
