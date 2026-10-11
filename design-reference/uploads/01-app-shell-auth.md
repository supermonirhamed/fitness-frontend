# Brief 01 — App shell, authentication & Today page

**Goal:** the frame every admin screen lives in, the sign-in flows, the "Today" landing page, and the small Super Admin console.

Stories: US-00.01, US-00.02, US-00.04, US-00.05, US-00.06, US-00.07 (permission-aware UI), US-00.09, US-00.13, US-01.13, US-12.15 (staff alerts).

## Screens

### 1. Sign in (organization subdomain)
- Organization logo and name at top (from the subdomain), language switch (العربية / English).
- Email + password, "Forgot password?", show/hide password.
- States: wrong credentials; too many attempts ("Try again in 1 minute"); account deactivated; organization suspended ("This account is suspended. Contact support."); unknown subdomain (separate "Organization not found" page).
- 2FA step (US-00.06, P1): 6-digit code input, "Use a recovery code".

### 2. Accept invitation / set password
- "You've been invited to join {Organization} as {Role}" → name confirmation, password + confirm, password rules shown live.
- Expired or used link state with "Ask for a new invitation".

### 3. Forgot / reset password
- Request screen (email) → "Check your email" → reset form → success → sign in.

### 4. App shell (desktop and mobile)
- **Sidebar** (start side: right in Arabic, left in English), collapsible, items shown only if the user has permission:
  Today · Calendar · Bookings · Clients · Services · Check-in · Staff · Branches & facilities · Settings.
  (Later releases add: Memberships, Payments, Academy, Reports, Marketing — leave room, don't design them.)
- **Header:** branch switcher (US-01.13): "All my branches" + each allowed branch, with the branch timezone shown; global search (clients, sessions); alerts bell with count (US-12.15); language toggle; user menu (profile, change password, 2FA, sign out).
- **Mobile:** bottom navigation for Reception/Coach (Today, Calendar, Check-in, Clients, More); header with branch switcher.
- Show how the shell looks for: Owner (everything), Receptionist (no Settings, no Staff), Coach (Today, My calendar, My sessions, Clients limited).

### 5. Today page (default landing)
Role-aware, operational, not a reporting dashboard (reports come later):
- **Receptionist / Manager:** today's sessions at the current branch as a time-ordered list or compact timeline, each with capacity indicator, coach, facility and status; quick actions (New booking, New client, Check-in); alerts panel (schedule conflicts, sessions starting soon that are full with waitlist, unpaid "pay at desk" bookings today).
- **Coach:** "My sessions today" cards with time, place, booked count, and a large "Open roster" button.
- Empty state: "No sessions today at {branch}".

### 6. Alerts drawer
- Opened from the bell. Grouped list (Conflicts, Waitlist, Payments due at desk, System), each item links to the record. Mark as read / mark all read.

### 7. Super Admin console (platform domain, not an organization subdomain)
- Tenants list (US-00.02): name, subdomain, owner, plan, status (Provisioning / Active / Suspended), created, branches, active clients; search and filter.
- Create tenant (US-00.01): Drawer with organization name, subdomain (live availability check and preview `slug.platform.com`), owner name/email, currency, timezone, language → shows **Provisioning** progress, then Active, or a failure with "Retry".
- Suspend / reactivate with required reason (Override-with-reason pattern).
- Simple, desktop-only, English is enough for this console.

## Rules that affect the UI
- Hide navigation items and action buttons the user has no permission for; if a user opens a URL they can't access, show the No-permission state.
- Branch-scoped screens always show which branch they're showing.
- If the user has only one branch, the switcher shows the branch name without a dropdown.

## States to design
Sign-in errors listed above · invitation expired · provisioning / failed tenant · Today empty · alerts empty · No-permission page · session expired ("You were signed out, sign in again").
