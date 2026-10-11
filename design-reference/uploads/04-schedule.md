# Brief 04 — Schedule (calendar & sessions)

**Goal:** the operational heart of the app. Managers plan one-off and recurring sessions; reception and coaches run the day from the calendar and session details.

Stories: US-03.01 – US-03.15, US-01.10 (facility double-booking), US-04.13 (waitlist panel on session).
Calendar and session details: **desktop and tablet**; session details and coach calendar must also work well on **mobile**.

> **Component note:** PrimeVue has no scheduler. The calendar will use a dedicated calendar library inside the PrimeVue theme (decision pending: FullCalendar — its resource columns per facility/coach need a paid licence — or a free alternative such as vue-cal). Design the calendar with standard scheduler anatomy (time grid, resource columns, event cards), styled with the design-system tokens.

## Screens

### 1. Main calendar (US-03.01)
- Toolbar: Today, previous/next (arrows flip in RTL), date picker, view switch **Day / Week / Month / List**, filters (branch from header, facility, coach, service/category, activity type, status), "New session".
- **Day view with resource columns:** columns per facility *or* per coach (toggle).
- **Session card:** time, service name (service colour), coach avatar + name, facility, capacity indicator `12/15`, waitlist badge `+3`, status (Draft dashed border, Cancelled muted + strikethrough, Full red, Completed faded). Compact variants for Week and Month.
- Closures/holidays shaded with label; outside business hours slightly greyed.
- Hover/click → session **popover** (quick facts + actions: Open, Add booking, Check-in roster, Edit, Cancel).
- Click empty slot → Create session prefilled. Drag to move / resize to change duration (with conflict check on drop).
- Multi-select mode for bulk Publish / Unpublish (US-03.11).
- Coach sees only their own sessions by default (toggle "All sessions" only if permitted).

### 2. Create session (Drawer; US-03.02, US-03.03)
- Service (AutoComplete with type icon) → defaults fill in.
- Branch, facility (linked facilities first, capacity shown next to each), coach(es) (eligible coaches first, unavailable ones disabled with reason), date, start time, duration, capacity (max = facility capacity), status Draft / Published.
- **Repeat** section: Does not repeat / Weekly — weekday toggles, every N weeks, ends on date / after N occurrences / never (rolling).
- **Live conflict panel** at the bottom of the drawer: hard conflicts (red, block Save) and warnings (amber, need confirmation): coach busy, facility busy, capacity > facility, coach on time off, outside business hours, holiday.
- For a series: **preview step** listing all occurrences with flags (conflict / holiday) and a checkbox to skip each one; summary "24 sessions will be created, 2 skipped".

### 3. Edit scope dialog (US-03.04, US-03.05)
- When editing a session that belongs to a series: radio **This session only / This and following / All in series**, with a one-line explanation each.
- Impact summary before saving: "8 future sessions have bookings; clients will be notified of the time change." Block with list when new capacity < existing bookings.

### 4. Session details (full page and mobile; US-03.08)
Header: service, date/time with branch timezone, facility, coach(es), status, capacity indicator, actions (Add booking, Message attendees [later], Edit, Substitute coach, Duplicate, Cancel session).
Tabs:
- **Roster:** booked clients (avatar, name, booking status, how it's paid — Complimentary / Pay at desk / Paid, alerts icons: first visit, health note, unsigned waiver), row actions (cancel, reschedule, mark no-show, record payment). "Add booking" button.
- **Waitlist** (US-04.13): position, name, joined at; actions: Promote now (override if full), Remove, drag to reorder (reason required). Waitlist settings: on/off, max size, mode, close window.
- **Attendance:** link to roster taking (brief 07).
- **Details:** series info ("Part of: Mon/Wed 18:00, until 31 Jan"), booking rules in effect.
- **Activity.**

### 5. Cancel session dialog (US-03.12)
- Reason (required Select + note), impact: "15 bookings and 3 waitlist entries will be cancelled. Credits are returned. Clients will be notified." For a series: this one / this and following / date range. Destructive confirm.

### 6. Substitute coach (US-03.13)
- Drawer listing coaches: eligible & free first, then busy/ineligible (disabled with reason). Toggle "Notify booked clients".

### 7. Conflict center (US-03.07)
- List grouped by type (coach, facility, capacity, time off, closure) with the session, the reason, and quick actions: Reassign coach, Change facility, Cancel session. Empty state: "No conflicts 🎉" (no emoji in Arabic UI copy — use an icon).

### 8. Appointment availability (US-03.09)
- For staff booking an appointment: choose service → coach or "Any available" → day strip → grid of available slots (in branch timezone). Unavailable times not shown. Selecting a slot continues to Create booking (brief 05).

### 9. Coach calendar (US-03.14, mobile-first)
- Agenda list by day: sessions and appointments with place and booked count; time-off blocks; tap → session details.

### 10. Events (US-03.10, P1)
- Create event: one registration covering several sessions (list of dates/times), event capacity, registration open/close dates.

## Rules that affect the UI
- Coach and facility double-booking is impossible (hard block, show the conflicting session).
- A session with bookings can't be unpublished — offer Cancel instead.
- Past sessions are read-only except attendance.
- Times always in the session's branch timezone; show the zone when "All branches" is selected.

## States to design
Empty calendar for a new branch · loading week · session Draft / Published / Full / Full + waitlist / Cancelled / Completed · conflict panel with hard and soft conflicts · series preview with skipped dates · edit-scope dialog · capacity reduction blocked · mobile session details · coach with no sessions today · No-permission on another branch's session.
