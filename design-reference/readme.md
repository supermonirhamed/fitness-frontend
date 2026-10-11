# Studio Admin Design System

Design system for the **MVP-1 staff/admin web app** of a multi-tenant SaaS for gyms, fitness studios, sports academies and personal trainers. Each organization runs on its own subdomain (`slug.platform.com`). Everything is modelled generically: **Services/Programs → Sessions → Bookings → Attendance**.

- **Users:** Owner, Admin, Branch Manager, Receptionist, Coach. Admin/finance screens are desktop-first; reception & coach screens (calendar, roster, check-in) are tablet/mobile-first.
- **Language:** Arabic (RTL) is primary, English (LTR) fully supported. RTL is native, not mirrored after the fact.
- **Multi-branch:** branches can sit in different timezones with their own VAT. A branch switcher in the header scopes most screens.
- **Build target:** Vue 3 + **PrimeVue 4** (styled mode, preset on Aura) + Tailwind logical utilities. Components here mirror PrimeVue anatomy so tokens map 1:1 onto a `definePreset`.
- **Brand:** neutral, energetic, trustworthy. The chrome must sit well under *any* customer's uploaded logo. Primary colour is a single token family so a per-org primary can be swapped in later.

## Sources
- `design-briefs/` (local folder, read-only): `README.md` (global context), `00-design-system.md` (foundations, component list, shared patterns), `01-app-shell-auth.md`, `02-organization-locations.md`, `03-services-catalog.md`, `04-schedule.md`, `05-bookings-waitlist.md`, `06-clients-family.md`, `07-check-in-attendance.md`, `08-staff-roles-settings.md`.
- The briefs reference `../user-stories/` and GitHub issues (story IDs like US-03.15) — not provided.
- **No visual source was provided** (no Figma, no codebase, no logo, no fonts). All visual values here are first-pass decisions made from the briefs' written requirements and should be reviewed.

## Index
- `styles.css` — entry point; `@import`s only.
- `tokens/` — `colors.css` (primitives, semantic aliases, severities, capacity, service colours; light + `[data-theme="dark"]`), `typography.css` (scale + RTL line-heights under `[dir="rtl"]`), `spacing.css` (4px scale, radii, elevation, control sizes, layout, motion), `fonts.css` (Google Fonts import), `icons.css` (PrimeIcons CDN), `base.css` (body reset, `.pi-dir` RTL flip, focus ring).
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing, Brand).
- `components/` — React primitives (see list below), one `@dsCard` per folder.
- `ui_kits/admin/` — click-through recreation of the admin app (see its README).
- `dev/ds-dev-loader.js` — fallback that transpiles component sources in-browser when `_ds_bundle.js` isn't compiled yet. Not for consumers.
- `SKILL.md` — Agent Skill entry.

## Components
PrimeVue families from brief 00 §2, plus shared patterns from §3 and the app shell from brief 01.
- **buttons/** — Button, SelectButton
- **forms/** — Field, InputText, InputNumber, Textarea, Select, MultiSelect, AutoComplete, DatePicker (+ Calendar), Checkbox, RadioButton, ToggleSwitch, FileUpload
- **data/** — DataTable, Tag, Badge, Avatar, Timeline
- **overlays/** — Drawer, Dialog, ConfirmDialog, Popover
- **navigation/** — Tabs, Breadcrumb, Stepper, Menu (incl. TieredMenu via nested `items`)
- **feedback/** — Message, Toast, Skeleton
- **patterns/** — PageHeader, FilterBar, BulkActionBar, EntityDrawer, StatusTag, CapacityIndicator, SessionCard, WhyNotMessage, OverrideDialog, ConflictList, EmptyState, NoPermission, ErrorState, PersonChip, TimeLabel, Money, VatSummary
- **shell/** — Sidebar, AppHeader (+ BranchSwitcher), BottomNav

**Intentional additions:** `Field` (label/help/error wrapper — PrimeVue uses FloatLabel/IftaLabel + Message; one wrapper keeps forms consistent). `BulkActionBar`, `SessionCard` (calendar event card — PrimeVue has no scheduler; brief 04 asks for standard scheduler anatomy).

**Not yet built:** TieredMenu as a separate component (covered by Menu), full Week/Month calendar views.

---

## CONTENT FUNDAMENTALS
- **Voice:** plain, operational, calm. Staff are busy at a front desk — copy tells them what happened and what to do next. No marketing tone.
- **Say why.** When an action is blocked, say the reason in one line: "Session is full — waitlist is off." "Booking is for another branch." Then offer the way out ("Override capacity", "Add to waitlist").
- **Show consequences before confirming.** "15 bookings and 3 waitlist entries will be cancelled. Credits are returned. Clients will be notified."
- **Person:** address the staff user as *you* ("You don't have access to this. Ask your administrator."). Refer to clients by first name in confirmations ("Sara will be #4 on the waitlist.").
- **Casing:** Sentence case everywhere — buttons, titles, tabs ("New booking", "Mark all present", "Record payment"). Statuses are Title-ish single words ("Checked-in", "Late cancel", "No-show").
- **Buttons are verbs:** New session, Add booking, Check in, Promote now, Allow entry. One primary action per page.
- **Numbers & time:** Western digits (0–9) in both languages. 24h by default (`18:00`), with zone badge when mixing branches (`18:00 AST`). Capacity is always `12 / 15`. Money with currency per org (`SAR 172.50`, `‏172.50 ر.س`).
- **Arabic:** Modern Standard Arabic, concise. No emoji in Arabic UI copy (brief 04: "No conflicts 🎉" becomes an icon). Avoid emoji generally — use PrimeIcons.
- **Bilingual sample data:** "سارة العتيبي", "نادي النخبة – فرع العليا", "Sara Al-Otaibi (M-10234)".
- **Fixed strings:** No-permission — "You don't have access to this. Ask your administrator." Session expired — "You were signed out, sign in again." Suspended org — "This account is suspended. Contact support." Later features — "Available in a later release" / "Coming soon".

## VISUAL FOUNDATIONS
- **Overall vibe:** quiet, neutral, dense-but-breathable operational UI. Colour is reserved for *meaning* (status, capacity, severity, service identity); chrome is cool grey + white.
- **Colour:** one brand blue (`--primary-600 #0b55d9`, scale 50–950) for primary actions, focus, selection. Cool neutral `surface` scale 0–950. Severities follow PrimeVue: success green, info sky, warn amber, danger red, help purple, secondary grey, contrast near-black. **One colour per status everywhere** via `StatusTag`. Eight categorical service colours (`--svc-1…8`) for calendar cards. Dark theme remaps the same semantic aliases under `[data-theme="dark"]`.
- **Type:** IBM Plex Sans (Latin) + IBM Plex Sans Arabic — one superfamily, both scripts. Scale: display 32, h1 24, h2 20, h3 16, h4 14, body 14, small 13, caption 12. Under `[dir="rtl"]` line-heights grow ~15–20% (body 1.57 → 1.8) and the Arabic face is placed first in the stack. Tabular numerals for times, capacity, money. IBM Plex Mono for member IDs.
- **Spacing:** 4px scale (`--space-1` = 4 … `--space-16` = 64). Page padding 24; card padding 16–20; form gaps 12–16.
- **Backgrounds:** flat. App background `--surface-50`, cards white. No gradients, no imagery, no textures — the only pattern is a diagonal hatch for *closed / outside business hours* on the calendar.
- **Cards:** white, 1px `--border-default`, radius 10, **no shadow** at rest. Shadows are for things that float.
- **Elevation:** `--shadow-1` (subtle; selected segment, small raised bits), `--shadow-2` (menus, popovers, toasts, dropdown panels), `--shadow-3` (dialogs, drawers).
- **Radii:** 4 tags · 6 inputs/buttons · 8 menu items/segments · 10 cards · 12 dialogs · pill for chips/badges.
- **Borders:** 1px everywhere; `--border-subtle` for row dividers, `--border-default` for cards, `--border-strong` for inputs. Draft sessions use a **dashed** border; Full sessions a red border.
- **Hover:** neutral surfaces darken to `--surface-hover`; solid buttons step one shade darker (600 → 700); text/outlined buttons get a tinted subtle background. No lift/translate.
- **Press:** `transform: scale(.98)` on buttons; no colour flash.
- **Focus:** 3px soft primary ring (`--focus-ring`) on keyboard focus; inputs also switch border to primary.
- **Disabled:** 50% opacity on buttons; inputs get `--surface-sunken` fill and muted text. Disabled options always carry a reason line ("Busy 18:00–19:00").
- **Motion:** short and functional — 120ms (hover/colour), 200ms (toggles, drawers), 280ms (overlays). Easing `cubic-bezier(.2,0,0,1)`. No bounces. Loading uses shimmer Skeletons that match layout, never full-page spinners.
- **Transparency & blur:** only the modal mask (`--mask`, 45% ink). No glassmorphism.
- **Imagery:** none from the product itself; client photos and org logos are user-uploaded. Placeholders are dashed boxes with a `pi-image`/`pi-user` icon.
- **Layout:** start-side sidebar (248px, collapses to 64), 56px header, scrolling content. Drawers open from the **end** side (right in LTR, left in RTL), 480px. Mobile: 64px bottom nav, 44px touch targets. Breakpoints: mobile 360–480, tablet 768–1024, desktop 1280+.
- **RTL:** use logical properties only (`inset-inline-start`, `margin-inline-end`, `padding-inline`, `border-inline-start`). Times, phone numbers and IDs are wrapped LTR-isolated.

## ICONOGRAPHY
- **System:** **PrimeIcons 7** (the brief's base), loaded from CDN in `tokens/icons.css`: `<i class="pi pi-calendar"></i>`. Line icons, ~1.5px stroke, 14–16px in UI, 20px in bottom nav, 24px in empty states.
- **RTL flip:** add `pi-dir` to any icon that implies direction — arrows, chevrons, angle-double, back/next, undo/redo (`pi-replay`), sign-in/out. `.pi-dir` is mirrored under `[dir="rtl"]` by `tokens/base.css`. **Never flip** clock, play, check, search, calendar, logos.
- **Common mappings:** Today `pi-sun` · Calendar `pi-calendar` · Bookings `pi-ticket` · Clients `pi-users` · Services `pi-th-large` · Check-in `pi-qrcode` · Staff `pi-id-card` · Branches `pi-building` · Settings `pi-cog` · Waiver missing `pi-file-edit` · Health note `pi-heart` · First visit `pi-star` · Blocked `pi-ban` · Override `pi-unlock` · Audit `pi-shield` · Payment `pi-wallet`.
- **Emoji:** not used. **Unicode as icons:** not used (except `–` in time ranges and `·` separators).
- **Logo:** the product has no logo in the sources — **none was created**. The sidebar and sign-in show the *customer organization's* uploaded logo slot (dashed placeholder) and org name in plain type.
