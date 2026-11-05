# Hostmeonline

Build the complete Hostme application for visual traffic exchange as specified in the attached "Role & Scope" and "Add-on Write Anything Creator Blog & Live" documents.

Style & Branding:
- Theme: Sleek dark modern aesthetic with subtle gold VIP accents and soft-purple search suggestions.
- Main Hero Slogan: "Turn visual space into collective momentum. Share slots, exchange audiences."
- Footer Slogan: "Every banner is a window to somewhere."
- Header: App Name "Hostme" centered alone at the top of every page.
- Aspect ratio: ALL Host banners, Guest cards, preview cards, and sponsored slots must strictly enforce a responsive 16:9 landscape aspect ratio (aspect-[16/9] with object-cover).
- Tactile button press states throughout the app.

Key Core Systems to implement:
1. Client-side Image Compression & Resizing:
   - When user crops or selects an image in the 16:9 upload canvas, resize to max width 1200px, convert to WebP with 80-85% quality, upload to Supabase Storage, and save public URL to host profile. Include loading indicator.
2. Homepage & Admin Root:
   - Set up the homepage (/) as the primary Hostme profile with admin ruchbaba@hotmail.com having live owner edit controls.
   - Global live stats ticker: "Total Entry Ports Shared: [Dynamic Count] | Total Creator Earnings Paid: $[Dynamic Amount]".
   - "Start a Host" button above search that expands the 16:9 upload form (image canvas, name with rotating placeholder prompts, email, destination URL).
   - "Write Anything" feature: Hostme-owner status card and live rotating queue ticker (smooth 5-7 second transition) above the footer.
   - 2-column 16:9 guest grid with slot rotation and rented 3rd slots.
3. Top Navigation Header & User States:
   - Left side: Sponsor dropdown menu (gold coin icon) for logged users with 3 options:
     * "Rent Out My Slots" (every 3rd slot unlocked as guest slots fill)
     * "Sponsor with Hosts" ($1.00 CPM / $0.001 per view to host)
     * "Sponsor with Hostme" ($10 for 10,000 impressions, first 5000 users get 10,000 impressions free gift activation)
     * Dynamic display of host earnings balance ticking up in real time next to the coin icon.
   - Right side: User menu with logged-out returning user quick-login (remembering latest 2), Supabase passwordless email OTP verification with shortcut to user's mail client, and logged-in owner profile management (+ Add extra host profile for $29.99, lock icon, masked email in-app messaging, direct inbox shortcut, and logout).
4. Host Profile Page:
   - 16:9 banner with overlay counters (Eye views, Spy counter with follow alerts, Invite as Guest / Share embed icon, Stars clicks & Sparkles impressions, DoorOpen entry ports).
   - External link popup on center-click.
   - Host metadata row: Display name & Tag list (+ Tags owner modal, max 13 tags).
   - 2-column guest slot grid, expansion (buy extra slot for $9.99), invitation management, and dynamic rotation.
5. Footer & Smart Search:
   - Centralized search trigger button (🔍) that reveals search bar with soft-purple auto-completion, semantic/approximate tag matching, and filter modal (views, stars, entries range sliders).
   - Infinite scrolling discovery grid with sponsored placement on every 3rd slot.
6. 8 Static Resource Routes:
   - /how-it-works, /manifesto, /use-cases, /submit-story, /invite, /faq, /history, /our-story with consistent layout, editable body, 16:9 shared banners, and community micro-board feed.
7. Backend tables, triggers, and mock email dispatch hooks for in-app messaging notifications and Spy alerts.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hostmeonline.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8eb811f9-d356-4979-8e43-67e94377fbee).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
