<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Paid items use Stripe Checkout (user's own key, `STRIPE_SECRET_KEY`) created in `src/lib/checkout.functions.ts`; items are granted only by the service-role-only `fulfill_checkout` SQL function after Stripe reports the session paid — why: client-callable buy RPCs must never grant paid items (they only work for the admin/owner, comped).
- No Stripe webhooks: purchases are confirmed on `/payment-success` and by `CheckoutSync` when the user returns to the app — why: keeps setup to one secret; add a webhook route if payments must apply while the user never returns.
