# Brief 02 — Organization, branches & facilities

**Goal:** owners and managers set up the organization, its branches (each with its own timezone, hours and VAT) and the physical spaces sessions run in.

Stories: US-01.01 – US-01.14, US-00.14, US-00.12 (archive/restore).

Mostly **desktop-first**; the facility availability view should also work on tablet.

## Screens

### 1. Organization settings (Settings → Organization)
- Sections (one page with anchored sections or vertical tabs): **Profile** (legal and display name, logo upload with preview, contact, website), **Localization** (currency, default timezone, default language, date/time format, week start), **Booking policies** (US-01.02).
- Currency becomes read-only after the first payment, with an info message explaining why.

### 2. Booking policies (organization defaults)
Grouped form, each field with a short helper text and an example:
- Booking opens (days before), booking closes (minutes before)
- Cancellation window (hours before)
- Late-cancel penalty: SelectButton None / Consume credit / Fixed fee (+ amount)
- No-show penalty: same control
- Waitlist: mode Manual / Automatic, close window (minutes before start)
- Info message: "Services, branches and single sessions can override these. Changes apply to new bookings only."

### 3. Branches list
- DataTable: name, status (Draft / Active / Inactive), timezone, facilities, active services, staff, today's sessions.
- Primary action "New branch". Filter by status. Archived filter with Restore action.

### 4. Create / edit branch (Drawer)
- Name (AR/EN), address, map pin (optional), **timezone** (searchable Select, default = org timezone), phone, email, photo, status.

### 5. Branch details (full page with Tabs)
Header: name, status tag, timezone badge, primary action "Edit".
- **Overview:** key facts, today's sessions count, staff count.
- **Business hours** (US-01.06): weekly grid, each day Closed or one or more time ranges (+ add range). Copy hours to other days.
- **Holidays & special hours** (US-01.07): list + "Add" Drawer (date or date range, Closed or custom hours, label). When saving a closure that overlaps sessions, show an **impact dialog**: "12 sessions on these dates" with list, choose "Cancel these sessions" or "Keep them".
- **Facilities:** list of the branch's facilities (see 6).
- **Services:** services offered here (read-only list with link to service; managed in brief 03).
- **Staff:** staff assigned here (read-only, managed in brief 08).
- **Tax / VAT** (US-01.14): VAT enabled toggle, rate %, prices include VAT (yes/no), tax registration number, legal entity name for receipts, "effective from" date for rate changes; preview of a receipt total line ("Subtotal 100.00 · VAT 15% 15.00 · Total 115.00").
- **Activity:** timeline of changes.

### 6. Facilities
- List per branch (or all branches with a branch column): name, type icon (Room, Studio, Field, Pool, Gym area, Court, Other), capacity, allowed services count, status.
- Create/edit Drawer: name, type, capacity, allowed services (MultiSelect, empty = all), description, photo; **sub-areas** (P1): repeatable rows (for example Lane 1–6) with their own capacity.

### 7. Facility availability view (US-01.11)
- Day / week timeline for one or several facilities (columns per facility in day view), showing sessions, buffers (hatched), closures (shaded).
- Clicking an empty slot → "Create session here" (opens Create Session from brief 04, prefilled).

### 8. Deactivate branch dialog (US-01.05)
- "This branch has 34 upcoming sessions and 210 bookings." Options: keep them / cancel all future sessions (with reason; clients will be notified). Confirm with typed branch name for safety.

## Rules that affect the UI
- Sessions created outside business hours show a warning (not a block) — the hours here feed that check.
- Facility capacity is a hard maximum for sessions; show it clearly.
- Timezones differ per branch: always show the timezone on branch pages and in the branch switcher.

## States to design
No branches yet (onboarding: "Create your first branch") · branch Draft (not visible to clients — banner) · inactive branch banner · closure impact dialog · VAT disabled · facility with sub-areas · archived list with restore · No-permission (Branch Manager trying to open another branch).
