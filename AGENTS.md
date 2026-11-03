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
- Messages are grouped into conversations by (my Host page, other party) in pure `src/lib/threads.ts`; replies always go through the `send_message` RPC — why: one tested rule decides who a reply goes to.
- Email delivery (message/Spy alerts, branded login email) is deferred: alerts queue in `email_outbox` and the UI labels them "coming soon" — why: user chose to postpone email; enabling it later only needs a sender that drains the outbox.
- Fire-and-forget Supabase calls (view/impression tracking) go through `fire()` in `src/lib/api.ts` — why: query builders are lazy and `void supabase.rpc(...)` never sends a request.
- Guide-page banners store live embeds origin-free as `/embed/<slug>` (parsed by `src/lib/embed-code.ts`) — why: the same value works on preview, published and custom domains.
- Host payouts are manual: `request_payout` moves every owned page balance into one `payout_requests` row (per-page `breakdown`), and only the admin's `decide_payout` marks it paid or rejects it (reject restores the breakdown) — why: no payout API; the owner sends money in PayPal by hand.
- Search by meaning: `expandTerms` in `src/lib/tags.ts` expands typed words into whole tag families (word forms, compounds, small typos), and `search_hosts` ranks exact tag/name hits first, then family/fuzzy hits — why: results still appear when no tag matches exactly; add categories by editing FAMILIES.
- Guide pages are reached by their editable `slug`; the `/$slug` loader redirects the page key or any non-current address to the current slug, and the admin menu reads links from the database — why: renaming a link never breaks old shared URLs.
- Guide-page body formatting uses the tiny markup in `src/lib/rich-text.ts` (`**bold**`, `[sm]`/`[lg]`/`[xl]`), rendered as React nodes, never raw HTML — why: owner formatting without an XSS surface.
- Host earnings are credited only inside `track_impression` for visitors with a known connection IP, capped per IP per page and per IP per day via `earn` rows in `track_events`; `request_payout` stores the distinct earning-visitor count for admin review — why: client session strings are forgeable, so the IP caps are the real limit.
- Every Host page's gifted personal guide page is a `static_pages` row with `host_id` (deleted with the host), created only by `ensure_host_page`; its `active` flag makes the banner's center tap open it instead of `destination_url`. Menus list only `host_id is null` pages — why: one page model and editor for owner guides and personal pages.
- Share codes and embed links are built with `publicOrigin()` (`src/lib/public-origin.ts`) and `shareBundle()` (`src/lib/embed-code.ts`) — why: preview addresses need a Lovable login, so copied codes must always point at the public site.
- The community board keeps one post per account per guide page, enforced by the `board_posts_replace_old` insert trigger — why: the rule holds no matter which client inserts.
