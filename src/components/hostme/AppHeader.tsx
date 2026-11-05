import { ClientOnly, Link } from "@tanstack/react-router";
import { SponsorMenu } from "./SponsorMenu";
import { UserMenu } from "./UserMenu";
import { CheckoutSync } from "@/hooks/use-checkout";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto grid h-14 max-w-3xl grid-cols-[1fr_auto_1fr] items-center px-3">
        <div className="justify-self-start">
          <ClientOnly fallback={<span className="h-9 w-9" />}>
            <SponsorMenu />
          </ClientOnly>
        </div>
        <Link to="/" className="press font-display text-xl font-bold tracking-tight text-foreground">
          Hostme
        </Link>
        <div className="justify-self-end">
          <ClientOnly fallback={<span className="inline-block h-9 w-9" />}>
            <UserMenu />
            <CheckoutSync />
          </ClientOnly>
        </div>
      </div>
    </header>
  );
}
