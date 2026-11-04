# Hostme roadmap

- [x] Backend: hosts, accounts, guests, invitations, spies, messages, posts, campaigns, purchases, static pages, board, email outbox, tracking + anti-fraud
- [x] Header: sponsor coin menu (rent stats, sponsor with hosts, sponsor with Hostme + 5000-user gift), user menu (returning users, email link login, owned pages, lock, messages, my email, static pages, logout)
- [x] Homepage = Hostme host page, stats ticker, Start a Host form, Write Anything status + rotating ticker, guest grid, footer search
- [x] Host page: banner overlays, tags (max 13), guest grid with rent/rotation/sponsors, invitations, share/embed codes
- [x] Image canvas: drag + pinch/scroll, 1200px WebP 82%, image safety check, upload
- [x] Footer search: purple autocomplete, related-tag matching, filters, infinite feed with sponsored slots
- [x] Write Anything page, basic messages list, 8 guide pages (editable by owner)
- [x] Live embed widget (/embed/<slug>): rotating host + guests + rented sponsor slide, Sparkle + shared sponsor impressions
- [x] Community micro-board on guide pages (live) + 16:9 banner upload for guide banners (owner)
- [x] Messages as conversations with reply box, read on open
- [x] Real payments via user's own Stripe key — checkout for extra page, guest slot, both impression packs (Stripe currently in test/sandbox mode)
- [x] Visitors' banner center-click opens the external page directly
- [x] Payouts: coin menu earnings → PayPal payout request (whole balance); admin Payout requests page with Mark paid / Reject
- [x] Guide pages: editable link field, bold slogan, bold/size formatting
- [x] Safety: host earnings capped per visitor connection; payout requests show visitor count
- [x] Search by related meaning (tag families) — done earlier
- [x] Sponsor with Hostme hides the Shared counter — done earlier

## New batch (Nov 1)
- [x] Homepage: remove guest grid; main image clickable with owner-set link
- [x] Autocomplete suggestions: 12 per scroll like results
- [x] Shared banner (embed + live banners): no overlays at all; image click → host page / first guest slot
- [x] Returning-user quick login shows the first-created page's name
- [x] Email inputs: no spellcheck/autocorrect, proper email keyboard
- [x] Share button: one big Copy button with all share options together, works on any domain
- [x] Tags editor available on pages owned by the Hostme owner account
- [x] Host pages: Write Anything ticker above guest grid, below metadata row
- [x] Write Anything: smaller 16:9 banners with 2-3 lines beside, rest below; 500-letter limit; remove top banner+form header banner on /write (owner banner same size as guest grid); remove top-right overlay on ticker
- [x] Static pages: first banner at top; board keeps only the latest post per host (replace in database)
- [x] Editor: italic, underline, align left/center/right, color palette, more
- [x] Personal guide page per Host page (gift): toggle in the external-link popup; first spot = live banner preview; editable title (changes link), slogan, text, shared banner, board, footer search; deleted with the account; not in top-right menu
- [x] Owner: create (+) and delete (x) extra guide pages in the top-right menu (owner only)
- [x] Spy feature labelled "coming soon"
- [x] Owner: Payouts in the top-right menu; Payout page counters (accounts, spies, page purchases, slot purchases, each impression type)
- [x] Delete test accounts ruchhost1@hotmail.com and ruchhost@hotmail.com
- [x] Re-read attachments and close any gaps

## Batch (Nov 3)
- [x] Homepage guest grid: hidden for visitors only, owner still sees it
- [x] Top-right menu: more than 8 Host pages -> dropdown on first page (icon between lock and +)
- [x] Link popup: remove explanations; "Visit my Webpage" toggle + own link only
- [x] Footer suggestions: wait for a second scroll before loading more
- [x] Near me: red/green location dot before tags, permission popup, search distance range (5/10/100 km, city, state, country, all)
- [x] Recheck everything
- [x] Footer search bar stays at the page bottom without covering content; more banners load only on a second scroll once at the bottom
- [x] Homepage counters slide across like a news ticker (white background in bright mode)
- [x] Publish

## Deferred
- [ ] Real email delivery for message + Spy alerts — coming soon (user deferred)
- [ ] Branded login email with banner preview — coming soon (user deferred)
