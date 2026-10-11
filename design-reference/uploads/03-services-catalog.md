# Brief 03 — Services catalog

**Goal:** admins define everything the business offers as generic Services (Class, Appointment, Event, Open access) or Programs, with per-branch availability, staff, facilities and booking rules.

Stories: US-02.01 – US-02.12. Desktop-first.

## Screens

### 1. Services list
- Filter bar: search (Arabic and English names), category, activity type, branch, status, coach.
- DataTable: colour dot + name, category, activity type (icon + label), default duration, default capacity, branches (chips, "+3"), status tag, upcoming sessions count.
- Bulk actions: Publish, Archive, Add to branch.
- Primary action: "New service" (split button: Service / Program).

### 2. Create service (Stepper in a full page or large Drawer)
1. **Type:** four large selectable cards — Class (group, scheduled), Appointment (1:1 from staff availability), Event (one-off or multi-day), Open access (entry without a session). Short explanation + example on each.
2. **Basics:** name (AR/EN tabs side by side), category, description (AR/EN), images, colour, level (Beginner / Intermediate / Advanced / All), age range, gender (Any / Male / Female).
3. **Defaults:** duration, capacity (hidden for Open access), buffer before/after (with helper "blocks the coach and room, not shown to clients"), appointment slot interval (Appointment only).
4. **Where & who:** branches (MultiSelect with per-branch capacity override), eligible staff, linked facilities.
5. **Booking & payment:** accepted with Membership / Package / Drop-in / Free (checkboxes, at least one), credit cost per booking; booking rules (see 4) — collapsed by default with "Uses organization defaults".
6. **Review & publish:** summary + Save as Draft / Publish.

### 3. Service details (full page with Tabs)
Header: colour, name, type, status tag, actions (Edit, Duplicate, Archive, Publish/Unpublish).
Tabs: **Overview** · **Branches** · **Staff** · **Facilities** · **Booking rules** · **Pricing** (shown disabled with "Available with memberships & payments" — MVP-2) · **Upcoming sessions** (list with capacity indicators) · **Activity**.

### 4. Booking rules tab (US-02.07)
For each rule (booking opens/closes, cancellation window, late-cancel penalty, no-show penalty, waitlist mode / max size / close window): a row with **Inherit** toggle, the effective value, and its **source** badge ("Organization", "Branch: Olaya", "This service"). When Inherit is off, the input appears.

### 5. Categories (Settings → Service categories)
- Simple list with drag-to-reorder: colour, icon, name AR/EN, services count, Archive.

### 6. Programs (catalog level, US-02.09)
- Same list page filtered to Programs (or a tab "Services | Programs").
- Create program Drawer: name AR/EN, sport/category, description, branches, enrollment mode (Term with dates / Rolling monthly), age range, gender, status.
- Program details shows an info panel: "Levels, age groups and groups are managed in the Academy module (coming in a later release)."

### 7. Archive service dialog (US-02.12)
- "This service has 18 upcoming sessions." Options: cancel them now (reason required) or keep them until they finish. Explains: "No new sessions can be created."

## Rules that affect the UI
- Draft services can't be scheduled for clients and aren't bookable — show a banner on Draft services.
- Capacity per branch can't exceed the largest linked facility's capacity: show the limit.
- "Payment methods" must have at least one option checked (inline validation).

## States to design
Empty catalog (onboarding with sample templates: "Yoga class", "Personal training", "Football training") · Draft banner · archived service (read-only) · no staff assigned warning ("No coach can deliver this service yet") · AR/EN name missing warning.
