# Admin web app — UI kit

Click-through recreation of the MVP-1 staff/admin app, composed from `components/`. Arabic (RTL) by default; toggle English in the header.

**Note:** no existing product design was supplied — these screens are first-pass designs from the written briefs (01, 04, 05, 06, 07), not recreations of shipped UI.

## Screens
- `SignIn.jsx` — org-branded sign in; password `wrong` shows the error state.
- `Today.jsx` — receptionist landing: time-ordered sessions with capacity + status, "Needs attention" alerts, quick actions. Skeleton loading on mount.
- `CalendarScreen.jsx` — Day view with resource columns (facilities ⇄ coaches), session popover, click empty slot → New session drawer with live conflict panel (try Studio A at 18:00 or capacity > facility).
- `SessionScreen.jsx` — session details: header facts, Roster (DataTable + bulk bar), Waitlist, Details, Activity timeline, Cancel session confirm.
- `ClientsScreen.jsx` — clients list (filter bar, selection, bulk actions), quick-create drawer with duplicate check (mobile `055 123 4567`), client profile overview.
- `CheckInScreen.jsx` — check-in desk: search → result card → Check in → green success (auto-clears 3s); "Omar" shows the denied card → Allow entry (override with reason); recent check-ins with Undo.
- `BookingDrawer.jsx` — create booking: client search, "booking for" child, eligibility checklist, payment source + VAT.
- `OrgSettings.jsx` — brief 02: Organization settings (Profile, Localization with read-only currency, Booking policies with helper + example), sticky unsaved-changes bar.
- `BranchesScreen.jsx` — brief 02: branches list (status filter, Archived + Restore), New/Edit branch drawer (searchable timezone), Deactivate dialog (keep/cancel + typed name). `#branches?state=empty` shows onboarding.
- `BranchDetails.jsx` — brief 02: branch page with Draft/Inactive banners and tabs: Overview, Business hours grid (ranges, copy to all), Holidays (+ closure impact dialog), Facilities (drawer with sub-areas), Services, Staff, Tax/VAT (receipt preview), Activity. "View availability" opens the facility day calendar.
- `ServicesScreen.jsx` — brief 03: services list (filters, bulk Publish/Add to branch/Archive, split "New service ▾ Service/Program"), Programs tab + drawer, empty catalog with templates, archive dialog, program details (Academy info panel), categories (drag to reorder).
- `ServiceWizard.jsx` — brief 03: 6-step create flow (type cards, AR/EN basics with missing-name warning, defaults with buffers, per-branch capacity vs facility limit, payment checkboxes with at-least-one validation, review → Draft/Publish).
- `ServiceDetails.jsx` — brief 03: service page with Draft / Archived / no-staff / missing-name banners; tabs incl. Booking rules (Inherit toggle + source badge) and disabled Pricing.
- `App.jsx` — shell, routing, toasts, alerts drawer. User menu → "View as" Owner / Receptionist / Coach (permission-aware sidebar + No-permission state) and dark mode.

Not built: Week/Month/List calendar views, bookings list, services, staff, branches, settings, mobile layouts.
