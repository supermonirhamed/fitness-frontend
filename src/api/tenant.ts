import { csrfCookie, http } from '@/lib/http'

export interface Organization {
  name: string
  slug: string
  locale: 'ar' | 'en'
  currency: string
  timezone: string
  date_format: string
  time_format: '12h' | '24h'
  /** 0 = Sunday … 6 = Saturday */
  week_start: number
  logo_url: string | null
}

export interface OrganizationProfile {
  name: string
  legal_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  website: string | null
  logo_url?: string | null
}

export interface RegionalSettings {
  currency: string
  timezone: string
  locale: 'ar' | 'en'
  date_format: string
  time_format: '12h' | '24h'
  week_start: number
}

export type Penalty = 'none' | 'consume_credit' | 'fixed_fee'

/** Booking & cancellation policy (US-01.02). */
export interface BookingPolicy {
  booking_opens_days: number
  booking_closes_minutes: number
  cancellation_window_hours: number
  late_cancel_penalty: Penalty
  late_cancel_fee: number | null
  no_show_penalty: Penalty
  no_show_fee: number | null
  waitlist_closes_minutes: number
  waitlist_mode: 'manual' | 'automatic'
  /** US-04.10: the session takes a waitlist when full… */
  waitlist_enabled: boolean
  /** …of at most this many people (0 = no limit). */
  waitlist_max_size: number
}

/** The organization's policy: the defaults plus organization-wide settings (US-04.01). */
export interface OrganizationBookingPolicy extends BookingPolicy {
  allow_overlapping_bookings: boolean
  /** Unattended bookings become No-show this long after the session ends (US-04.06). */
  no_show_after_minutes: number
}

/** Overrides: null inherits from the level above. */
export type BookingPolicyOverrides = { [K in keyof BookingPolicy]: BookingPolicy[K] | null }

export type PolicySource = 'organization' | 'location' | 'service' | 'session'

export interface BookingPolicyOptions {
  penalties: Penalty[]
  waitlist_modes: BookingPolicy['waitlist_mode'][]
}

export interface LocationBookingPolicy {
  overrides: Partial<BookingPolicy>
  organization: BookingPolicy
  effective: BookingPolicy
  sources: Record<string, PolicySource>
}

/** A service's booking rules (US-02.07), optionally at one of its branches. */
export interface ServiceBookingPolicy {
  overrides: Partial<BookingPolicy>
  location: { id: number; name: string } | null
  /** What it gets without its own overrides, and where from. */
  inherited: BookingPolicy
  inherited_sources: Record<string, PolicySource>
  effective: BookingPolicy
  sources: Record<string, PolicySource>
}

export interface StaffUser {
  id: number
  name: string
  email: string
  locale: 'ar' | 'en' | null
  roles: string[]
  two_factor_enabled: boolean
  two_factor_required: boolean
  /** Effective permissions (module.action), for hiding what the user can't do. The API checks anyway. */
  permissions: string[]
  scope: AccessScope
  /** Locations this user may see; null means every location (US-00.09). */
  location_ids: number[] | null
  /** The header branch switcher (US-01.13); null current = all my branches. */
  current_location_id: number | null
  switchable_locations: SwitchableLocation[]
}

export interface SwitchableLocation {
  id: number
  name: string
  timezone: string
  status: 'Draft' | 'Active' | 'Inactive'
}

export type LocationStatus = 'Draft' | 'Active' | 'Inactive'

/** Branch figures (US-01.04); null until the module behind it exists. */
export interface LocationStats {
  facilities: number | null
  active_services: number | null
  staff: number
  today_sessions: number | null
}

export interface Location {
  id: number
  name: string
  status: LocationStatus
  timezone: string
  archived_at?: string | null
  stats?: LocationStats
}

/** What deactivating a branch would affect (US-01.05). */
export interface DeactivationImpact {
  upcoming_sessions: number
  upcoming_bookings: number
}

export type FutureSessionsChoice = 'keep' | 'cancel'

/** "HH:MM"; an end of "24:00" is midnight. */
export interface TimeRange {
  start: string
  end: string
}

/** Days "0" (Sunday) to "6"; an empty list is closed. */
export type WeeklyHours = Record<string, TimeRange[]>

export const FACILITY_TYPES = [
  'Room',
  'Studio',
  'Field',
  'Pool',
  'Gym Area',
  'Court',
  'Other',
] as const
export type FacilityType = (typeof FACILITY_TYPES)[number]
export type FacilityStatus = 'Active' | 'Inactive'

export interface SubArea {
  id: number | null
  name: string
  capacity: number
}

/** A room, studio, field, pool, gym area or court of a branch (US-01.08). */
export interface Facility {
  id: number
  name: string
  type: FacilityType
  location_id: number
  location?: { id: number; name: string; timezone: string } | null
  capacity: number
  status: FacilityStatus
  description: string | null
  photo_url: string | null
  archived_at: string | null
  sub_areas?: SubArea[]
  /** Allowed services (US-01.09); empty: any service. */
  allowed_services?: { id: number; display_name: string | null }[]
}

export interface FacilityInput {
  name: string
  type: FacilityType
  location_id: number
  capacity: number
  status?: FacilityStatus
  description: string | null
  sub_areas?: SubArea[]
  service_ids?: number[]
}

/** Time a facility is taken (US-01.10): a session (EP-03) or blocked by staff. Times are ISO (UTC). */
export interface FacilityReservation {
  id: number
  kind: 'session' | 'block'
  title: string
  facility_id: number
  facility: string | null
  starts_at: string
  ends_at: string
  /** Including setup/cleanup buffers. */
  blocked_from: string
  blocked_until: string
  coach: string | null
}

/** Something in the way of a booking (409 facility_conflict). */
export interface FacilityConflictItem {
  id: number
  kind: 'session' | 'block'
  title: string
  facility: string | null
  starts_at: string
  ends_at: string
  coach: string | null
}

export interface AvailabilityDay {
  date: string
  /** Opening ranges that day; [] closed; null weekly hours not set (open all day). */
  hours: TimeRange[] | null
  override: { label: string; closed: boolean } | null
}

export interface FacilityAvailability {
  facility: {
    id: number
    name: string
    type: FacilityType
    capacity: number
    status: FacilityStatus
    parent_id: number | null
  }
  timezone: string
  days: AvailabilityDay[]
  reservations: FacilityReservation[]
}

/** Text in Arabic and/or English (catalog, EP-02). */
export interface Translated {
  ar?: string | null
  en?: string | null
}

/** A service category (US-02.01). */
export interface ServiceCategory {
  id: number
  name: Translated
  display_name: string | null
  color: string
  icon: string
  sort_order: number
  archived_at: string | null
  services_count?: number
}

export interface ServiceCategoryInput {
  name: Translated
  color: string
  icon: string
}

export const ACTIVITY_TYPES = ['Class', 'Appointment', 'Event', 'Open Access'] as const
export type ActivityType = (typeof ACTIVITY_TYPES)[number]
export type ServiceStatus = 'Draft' | 'Published' | 'Archived'
export type SkillLevel = 'All' | 'Beginner' | 'Intermediate' | 'Advanced'
export type GenderRestriction = 'Any' | 'Male' | 'Female'

/** A branch offering a service (US-02.03), with its overrides. */
export interface ServiceLocation {
  location_id: number
  name?: string
  capacity_override: number | null
  price_override: string | number | null
}

/** A service (US-02.02). */
export interface Service {
  id: number
  name: Translated
  display_name: string | null
  description: Translated
  display_description: string | null
  activity_type: ActivityType
  category_id: number
  category?: {
    id: number
    display_name: string | null
    color: string
    icon: string
    archived: boolean
  }
  default_duration: number
  default_capacity: number | null
  buffer_before: number
  buffer_after: number
  /** Appointments (US-03.09): minutes between slot starts; null: back to back. */
  slot_interval: number | null
  /** How it can be paid for (US-02.08). */
  allow_membership: boolean
  allow_package: boolean
  allow_drop_in: boolean
  is_free: boolean
  credit_cost: number
  status: ServiceStatus
  color: string | null
  own_color: string | null
  skill_level: SkillLevel
  age_min: number | null
  age_max: number | null
  gender: GenderRestriction
  equipment_notes: string | null
  photo_url: string | null
  bookable: boolean
  locations?: ServiceLocation[]
  /** Staff who may deliver it (US-02.05); empty: anyone. */
  staff?: { id: number; name: string }[]
  /** Facilities suited to it (US-02.06). */
  facilities?: { id: number; name: string; location_id: number }[]
}

export interface StaffOption {
  id: number
  name: string
  roles: string[]
}

export interface ServiceInput {
  name: Translated
  description: Translated | null
  activity_type: ActivityType
  category_id: number | null
  default_duration: number | null
  default_capacity: number | null
  buffer_before: number | null
  buffer_after: number | null
  slot_interval?: number | null
  allow_membership: boolean
  allow_package: boolean
  allow_drop_in: boolean
  is_free: boolean
  credit_cost: number | null
  status?: ServiceStatus
  color: string | null
  skill_level: SkillLevel
  age_min: number | null
  age_max: number | null
  gender: GenderRestriction
  equipment_notes: string | null
  locations: ServiceLocation[]
  staff_ids?: number[]
  facility_ids?: number[]
}

export type EnrollmentMode = 'Term' | 'Rolling'

/** A program clients enroll into (US-02.09); levels and groups come with the Academy (EP-10). */
export interface Program {
  id: number
  name: Translated
  display_name: string | null
  description: Translated
  category_id: number
  category?: { id: number; display_name: string | null; color: string; icon: string }
  status: ServiceStatus
  enrollment_mode: EnrollmentMode
  term_start: string | null
  term_end: string | null
  age_min: number | null
  age_max: number | null
  gender: GenderRestriction
  locations?: { id: number; name: string }[]
}

export interface ProgramInput {
  name: Translated
  description: Translated | null
  category_id: number | null
  status?: ServiceStatus
  enrollment_mode: EnrollmentMode
  term_start: string | null
  term_end: string | null
  age_min: number | null
  age_max: number | null
  gender: GenderRestriction
  location_ids: number[]
}

/** A branch's VAT (US-01.14). Rates are "15.00"; each applies from its date. */

/** A session on the calendar (US-03.01); times in UTC and in the branch's local time (D4). */
export type SessionStatus = 'Draft' | 'Published' | 'Cancelled' | 'Completed'

export interface CalendarSession {
  id: number
  service: { id: number; name: string | null; color: string | null; activity_type: ActivityType }
  location: { id: number; name: string; timezone: string }
  facility: { id: number; name: string; capacity: number }
  coaches: { id: number; name: string }[]
  /** Substituted (US-03.13): the coach who was replaced. */
  original_coach: { id: number; name: string | null } | null
  series_id: number | null
  /** A day of an event (US-03.10). */
  event_id: number | null
  /** Edited apart from its series (US-03.04). */
  exception: boolean
  /** Started or cancelled: not edited. */
  locked: boolean
  starts_at: string
  ends_at: string
  local: { date: string; start: string; end: string }
  capacity: number | null
  booked: number
  waitlist: number
  status: SessionStatus
}

export interface CalendarBranch {
  id: number
  name: string
  timezone: string
  business_hours: WeeklyHours | null
  closures: {
    label: string
    start_date: string
    end_date: string
    closed: boolean
    hours: TimeRange[]
  }[]
}

export interface CalendarFilters {
  from: string
  to: string
  location_id?: number
  facility_ids?: number[]
  coach_ids?: number[]
  service_id?: number
  category_id?: number
  activity_type?: ActivityType
  statuses?: string[]
  mine?: boolean
}

/** What stands in the way of a session (US-03.02/06): hard ones block, soft ones need confirming. */
export interface SessionConflictItem {
  level: 'hard' | 'soft'
  /**
   * Hard: facility_busy, facility_blocked, coach_busy, coach_time_off, over_capacity.
   * Soft: outside_hours, holiday, outside_availability, coach_time_off_pending (US-03.06).
   */
  code: string
  title: string
  who: string | null
  when: string | null
  session_id: number | null
}

export interface SessionInput {
  service_id: number
  location_id: number
  facility_id: number
  coach_ids: number[]
  date: string
  start_time: string
  duration: number
  capacity: number
  status: 'Draft' | 'Published'
  confirm_warnings?: boolean
}

/** A weekly series (US-03.03): the session fields with the recurrence instead of a date. */
export interface SeriesInput extends Omit<SessionInput, 'date'> {
  starts_on: string
  weekdays: number[]
  every_weeks: number
  ends: 'date' | 'count' | 'never'
  ends_on?: string | null
  occurrences?: number | null
  skip_dates?: string[]
}

export interface SeriesPreviewItem {
  date: string
  start: string
  end: string
  starts_at: string
  conflicts: SessionConflictItem[]
}

/** The session details page (US-03.08). Roster and waitlist fill with EP-04. */
export interface SessionDetails extends CalendarSession {
  series: {
    id: number
    weekdays: number[]
    every_weeks: number
    start_time: string
    ends_on: string | null
    rolling: boolean
  } | null
  policy: BookingPolicy
  /** Can it take a booking now, and if not, why (US-03.15). */
  booking: {
    state: 'available' | 'almost' | 'full' | 'full_waitlist' | 'cancelled'
    can_book: boolean
    can_waitlist: boolean
    reason:
      | 'cancelled'
      | 'completed'
      | 'started'
      | 'not_open'
      | 'closed'
      | 'full_waitlist_closed'
      | 'full'
      | 'draft'
      | null
    params: Record<string, string | number>
  }
  event: {
    id: number
    capacity: number
    registered: number
    registration_opens_on: string | null
    registration_closes_on: string | null
    days: number
  } | null
  issues: SessionConflictItem[]
  created_by: string | null
  created_at: string | null
  roster: Booking[]
  waitlist_entries: WaitlistEntry[]
  policy_sources: Record<string, PolicySource>
  /** What this session sets itself; the rest is inherited. */
  session_policy: Partial<BookingPolicy>
  activity: {
    action: string
    user: string | null
    at: string | null
    changed: string[]
    reason: string | null
  }[]
}

/** Free appointment slots of one day (US-03.09), local times at the branch. */
export interface AppointmentDay {
  date: string
  slots: {
    start: string
    end: string
    starts_at: string
    coaches: { id: number; name: string; facility_id: number }[]
  }[]
}

/** A new event (US-03.10): its dates become linked sessions. */
export interface EventInput {
  service_id: number
  location_id: number
  facility_id: number
  coach_ids: number[]
  status: 'Draft' | 'Published'
  capacity: number
  session_capacity?: number | null
  dates: { date: string; start_time: string; end_time: string }[]
  registration_opens_on: string | null
  registration_closes_on: string | null
  confirm_warnings?: boolean
}

export interface ScheduledEventDetails {
  id: number
  service: { id: number; name: string | null }
  location: { id: number; name: string }
  capacity: number
  registered: number
  registration_opens_on: string | null
  registration_closes_on: string | null
  registration_open: boolean
  status: SessionStatus
  sessions: CalendarSession[]
}

/** Which sessions a cancel covers (US-03.12). */
export type CancelTarget =
  | { mode: 'ids'; ids: number[] }
  | { mode: 'following'; session_id: number }
  | { mode: 'range'; location_id: number; from: string; to: string }

/** Who could take over a session (US-03.13), best first. */
export interface SubstituteCandidate {
  id: number
  name: string
  current: boolean
  eligible: boolean
  level: 'hard' | 'soft' | null
  issues: SessionConflictItem[]
}

/** The signed-in staff member's own schedule (US-03.14). */
export interface MySchedule {
  sessions: CalendarSession[]
  availability: {
    location: { id: number; name: string | null; timezone: string | null }
    weekly: WeeklyHours
  }[]
  time_off: {
    starts_at: string
    ends_at: string
    all_day: boolean
    reason: string | null
    status: 'Approved' | 'Pending'
  }[]
  /** A calendar feed link exists. */
  feed: boolean
}

/** A client (US-05.01). Contact details are null when `contact_hidden` (no clients.contact_view). */
export interface Client {
  id: number
  member_id: string | null
  first_name: string
  last_name: string
  name: string
  mobile: string | null
  email: string | null
  address: string | null
  national_id: string | null
  contact_hidden: boolean
  date_of_birth: string | null
  age: number | null
  gender: 'female' | 'male' | null
  preferred_language: 'ar' | 'en' | null
  home_location: { id: number; name: string } | null
  marketing_consent: boolean
  status: 'Active' | 'Inactive' | 'Blocked' | 'Lead'
  /** In the list (US-05.04). */
  last_visit_at?: string | null
  upcoming_bookings?: number
  /** Manual labels (US-05.12). */
  tags?: Tag[]
  /** Why blocked or inactive, and whether the personal data was deleted (US-05.13). */
  status_reason: string | null
  anonymized: boolean
  /** A health note exists (US-05.03); reading it needs clients.health_view. */
  has_health_notes: boolean
  photo_url: string | null
  created_at: string | null
}

export interface ClientInput {
  first_name: string
  last_name: string
  mobile: string | null
  email: string | null
  date_of_birth: string | null
  gender: 'female' | 'male' | null
  address: string | null
  national_id: string | null
  preferred_language: 'ar' | 'en' | null
  home_location_id: number | null
  marketing_consent: boolean
}

export type TimelineType =
  'bookings' | 'cancellations' | 'attendance' | 'waitlist' | 'payments' | 'profile' | 'notes'

/** One thing that happened with a client (US-05.06). */
export interface TimelineEvent {
  id: number
  action: string
  type: TimelineType | 'other'
  at: string | null
  user: string | null
  values: Record<string, unknown>
}

/** The client profile's alerts and overview (US-05.05). */
export interface ClientOverview {
  alerts: { blocked: boolean; health_note: boolean; unpaid_bookings: number }
  upcoming: Booking[]
  attendance: Record<
    'last_30' | 'last_90',
    { attended: number; no_shows: number; rate: number | null }
  >
}

/** The clients list filters (US-05.04). Dates are Y-m-d. */
export interface ClientFilters {
  q?: string
  location_id?: number
  status?: Client['status'][]
  age_min?: number
  age_max?: number
  created_from?: string
  created_to?: string
  last_visit?: 'never'
  visited_from?: string
  visited_to?: string
  tag_ids?: number[]
  segment_id?: number
}

export type GuardianPermission =
  'can_book' | 'can_pay' | 'can_view_performance' | 'receives_notifications'

/** A guardian–child link (US-05.08), seen from one side: `client` is the other person. */
export interface FamilyLink {
  id: number
  relation: 'mother' | 'father' | 'guardian' | 'other'
  can_book: boolean
  can_pay: boolean
  can_view_performance: boolean
  receives_notifications: boolean
  client: {
    id: number
    name: string
    member_id: string | null
    age: number | null
    status: Client['status']
    photo_url: string | null
  } | null
}

export interface ClientFamily {
  is_child: boolean
  guardians: FamilyLink[]
  dependents: FamilyLink[]
}

/** The family page (US-05.10): each member, their upcoming bookings and what they owe at the desk. */
export interface FamilyPage {
  members: {
    client: {
      id: number
      name: string
      member_id: string | null
      age: number | null
      status: Client['status']
      photo_url: string | null
    }
    role: 'guardian' | 'child'
    guardians: number[]
    upcoming: Booking[]
    owed: number
  }[]
  currency: string
  owed: number
}

/** A membership plan (US-06.01). */
export type PlanKind = 'membership' | 'package'
export type PlanActivation = 'purchase' | 'chosen_date' | 'first_use'

/**
 * A product clients buy (EP-06): a membership plan (US-06.01) or a credit package (US-06.02), with
 * its activation rule (US-06.03), service eligibility (US-06.04) and branches (US-06.05).
 */
export interface MembershipPlan {
  id: number
  kind: PlanKind
  name: Translated
  description: Translated | null
  display_name: string
  status: 'Draft' | 'Published' | 'Archived'
  type: 'Unlimited' | 'Limited' | null
  visit_limit: number | null
  visit_period: 'week' | 'month' | null
  billing: 'one_time' | 'recurring' | null
  duration_value: number | null
  duration_unit: 'days' | 'weeks' | 'months' | 'years' | null
  billing_interval: 'month' | 'year' | null
  min_commitment_months: number | null
  joining_fee: number | null
  credits: number | null
  validity_mode: 'days' | 'fixed_date' | null
  validity_days: number | null
  valid_until: string | null
  drop_in_service_id: number | null
  drop_in_service?: string | null
  activation: PlanActivation
  activation_max_wait_days: number | null
  /** US-06.06: only for clients who never bought any product, or never this one. */
  intro_offer: 'new_clients' | 'first_time' | null
  rules: {
    services: {
      mode: 'all' | 'categories' | 'services' | 'programs'
      category_ids: number[]
      service_ids: number[]
      program_ids: number[]
      exclude_service_ids: number[]
    }
    locations: {
      mode: 'all' | 'home' | 'selected'
      location_ids: number[]
      include_future: boolean
    }
    limits: {
      per_day: number | null
      per_week: number | null
      hours: { from: string; to: string } | null
    }
  }
  prices: { location_id: number; location: string; price: number }[]
  currency: string
  /** US-06.07: clients holding it now, and sales since the first of the month. */
  active_holders?: number | null
  sales_this_month?: number | null
}

/** The plan details page (US-06.07): prices with VAT, rules by name. */
export interface MembershipPlanDetails extends MembershipPlan {
  pricing: {
    location_id: number
    location: string
    price: number
    vat_rate: string | null
    prices_include_vat: boolean
    net: number
    vat: number
    gross: number
  }[]
  rule_names: {
    categories: string[]
    services: string[]
    programs: string[]
    excluded: string[]
    locations: string[]
  }
}

/** A client holding a plan now (US-06.07). */
export interface PlanHolder {
  id: number
  status: ClientEntitlement['status']
  client: { id: number; name: string | null; member_id: string | null }
  credits_total: number | null
  credits_left: number | null
  purchased_on: string
  starts_on: string | null
  ends_on: string | null
  sold_at: string | null
}

export type MembershipPlanInput = Omit<
  MembershipPlan,
  | 'id'
  | 'display_name'
  | 'prices'
  | 'currency'
  | 'drop_in_service'
  | 'active_holders'
  | 'sales_this_month'
> & {
  prices: { location_id: number; price: number }[]
}

/** A membership or package a client holds (EP-06), as shown on their profile. */
export interface ClientEntitlement {
  id: number
  kind: PlanKind
  status: 'Pending' | 'Active' | 'Frozen' | 'Expired' | 'Cancelled' | 'Exhausted'
  name: string
  plan_id: number
  type: 'Unlimited' | 'Limited' | null
  billing: 'one_time' | 'recurring' | null
  billing_interval: 'month' | 'year' | null
  activation: PlanActivation
  activated_by: 'purchase' | 'date' | 'booking' | 'check_in' | 'timeout' | null
  credits_total: number | null
  credits_used: number
  credits_left: number | null
  purchased_on: string
  starts_on: string | null
  ends_on: string | null
  activate_by: string | null
  ends_if_started_today: string | null
  sold_at: string | null
  locations: MembershipPlan['rules']['locations'] | null
}

/** A client import (US-05.15): file, column mapping and result report. */
export interface ClientImport {
  id: number
  file: string
  status: 'uploaded' | 'queued' | 'running' | 'done' | 'failed'
  headers: string[]
  mapping: Record<string, number>
  duplicates: 'skip' | 'update'
  total: number
  created: number
  updated: number
  skipped: number
  failed: number
  report: {
    row: number
    status: 'update' | 'skip' | 'error'
    messages: string[]
    client_id?: number | null
  }[]
  finished_at: string | null
  fields: string[]
}

export interface ImportPreview {
  counts: Record<'create' | 'update' | 'skip' | 'error', number>
  rows: {
    row: number
    status: 'create' | 'update' | 'skip' | 'error'
    messages: string[]
    values: { first_name: string; last_name: string; mobile: string | null; email: string | null }
  }[]
}

/** Merging duplicate clients (US-05.14). */
export interface MergePreview {
  primary: Client
  secondary: Client
  fields: Record<string, { primary: string | null; secondary: string | null }>
  moves: Record<string, number>
}

/** A manual label on clients (US-05.12). */
export interface Tag {
  id: number
  name: string
  color: string | null
  clients_count?: number
}

/** The rules of a dynamic segment: the clients list filters (US-05.12). */
export interface SegmentRules {
  location_id?: number
  status?: Client['status'][]
  age_min?: number
  age_max?: number
  created_from?: string
  created_to?: string
  last_visit?: 'never'
  no_visit_days?: number
  tag_ids?: number[]
}

export interface Segment {
  id: number
  name: string
  type: 'dynamic' | 'static'
  rules: SegmentRules
  count: number
}

/** An internal note on a client (US-05.11); never shown to the client. */
export interface ClientNote {
  id: number
  body: string
  visibility: 'all' | 'managers' | 'me'
  pinned: boolean
  author: string | null
  created_at: string | null
  updated_at: string | null
  edited: boolean
  can_edit: boolean
  can_delete: boolean
}

/** A waiver template (US-05.07), with its latest text. */
export interface WaiverTemplate {
  id: number
  name: Translated
  display_name: string
  required_for: 'all' | 'services' | 'minors'
  services: { id: number; name: string }[]
  status: 'Active' | 'Archived'
  version: number | null
  content: Translated | null
  published_at: string | null
  versions_count: number
  versions?: { version: number; requires_resign: boolean; published_at: string }[]
}

export interface WaiverSignature {
  id: number
  version: number
  signer_name: string
  guardian: { id: number; name: string | null } | null
  method: 'typed' | 'drawn'
  signed_at: string
  collected_by: string | null
}

/** A client's waivers: signed, missing, or to sign again after a new version (US-05.07). */
export interface ClientWaiverStatus {
  minor: boolean
  waivers: {
    template_id: number
    name: string
    required_for: WaiverTemplate['required_for']
    services: string[]
    version: number | null
    state: 'signed' | 'missing' | 'resign'
    signed: WaiverSignature | null
  }[]
}

/** Emergency contacts and health notes (US-05.03). */
export interface ClientHealth {
  contacts: { id: number; name: string; relation: string; phone: string }[]
  has_health_notes: boolean
  /** Null when restricted. */
  health_notes: string | null
  health_restricted: boolean
  can_edit_health: boolean
}

/** A client with the same mobile or email (US-05.01); hidden ones carry no details. */
export interface ClientMatch {
  id: number | null
  name: string | null
  member_id: string | null
  matched_on: 'mobile' | 'email'
  visible: boolean
}

export type EligibilityCheck =
  | 'session'
  | 'window'
  | 'client'
  | 'restrictions'
  | 'capacity'
  | 'duplicate'
  | 'overlap'
  | 'waivers'
  | 'entitlement'

/** The checks staff with bookings.override may bypass, with a reason. */
export type OverridableCheck = 'capacity' | 'window' | 'waivers' | 'entitlement'

export type EntitlementSource =
  'membership' | 'package' | 'drop_in' | 'complimentary' | 'pay_at_desk' | 'guest_pass'

/** How a member's guest can be paid for, and the service's restrictions the guest form asks about (US-04.07). */
export interface GuestOptions {
  entitlements: EntitlementSource[]
  restrictions: {
    gender: 'Any' | 'Male' | 'Female' | null
    age_min: number | null
    age_max: number | null
  }
}

export type PaymentMethod = 'cash' | 'bank_transfer' | 'card_terminal' | 'other'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid' | 'not_required'

/** A payment recorded at the desk (US-04.15); amounts in major units. */
export interface Payment {
  id: number
  receipt_number: string
  booking_id: number | null
  client_id: number
  currency: string
  amount: number
  net: number
  vat: number
  vat_rate: string | null
  method: PaymentMethod
  reference: string | null
  note: string | null
  status: 'Recorded' | 'Voided'
  recorded_by: string | null
  recorded_at: string | null
  void_reason: string | null
  voided_by: string | null
  voided_at: string | null
}

/** What a booking costs at the desk and what was paid (US-04.15). */
export interface BookingPayments {
  currency: string
  required: boolean
  price: number | null
  net: number | null
  vat: number | null
  rate: string | null
  due: number | null
  paid: number
  balance: number | null
  status: PaymentStatus
  payments: Payment[]
}

/** Everything a printed receipt shows. */
export interface Receipt extends Payment {
  organization: { name: string; logo_url: string | null }
  branch: {
    name: string | null
    address: string | null
    legal_name: string | null
    tax_number: string | null
  }
  client: { name: string | null; member_id: string | null }
  item: { service: string | null; session: string | null }
  recorded_local: string | null
}

/** A client waiting for a place in a full session (US-04.10). */
export interface WaitlistEntry {
  id: number
  session_id: number
  client: { id: number; name: string | null; member_id: string | null; photo_url: string | null }
  status: 'Waiting' | 'Promoted' | 'Skipped' | 'Expired' | 'Removed'
  /** 1 = next in line, while Waiting. */
  place: number | null
  entitlement_source: EntitlementSource
  booking_id: number | null
  reason: string | null
  added_by: string | null
  joined_at: string
  closed_at: string | null
}

/** A booking with its policy terms and timeline (US-04.09). */
export interface BookingDetails extends Booking {
  policy: Partial<BookingPolicy> | null
  terms: Omit<CancellationTerms, 'can_waive'> | null
  timeline: {
    action: string
    at: string | null
    user: string | null
    values: Record<string, unknown>
  }[]
}

export interface BookingFilters {
  client_id?: number
  location_id?: number
  service_id?: number
  coach_id?: number
  status?: Booking['status'][]
  channel?: Booking['channel']
  entitlement_source?: EntitlementSource
  from?: string
  to?: string
  q?: string
  payment_status?: 'unpaid' | 'paid'
  /** desc: latest first (past bookings). */
  order?: 'asc' | 'desc'
}

/** A recurring booking (US-04.08) and what booking each occurrence did. */
export interface RecurringBooking {
  id: number
  status: 'Active' | 'Ended' | 'Cancelled'
  starts_on: string
  ends_on: string | null
  until_entitlement_ends: boolean
  summary: Record<
    'booked' | 'skipped' | 'waitlisted',
    {
      session_id: number
      date: string
      start: string
      booking_id?: number
      reasons?: { code: string; message: string }[]
    }[]
  >
}

/** A booking (EP-04) as the roster shows it. */
export interface Booking {
  id: number
  session_id: number
  client: { id: number; name: string | null; member_id: string | null; photo_url: string | null }
  status:
    | 'Confirmed'
    | 'Attended'
    | 'Cancelled'
    | 'LateCancel'
    | 'NoShow'
    | 'CancelledByBusiness'
    | 'Rescheduled'
  /** In the bookings list and details (US-04.09). */
  session?: {
    id: number
    service: string | null
    color: string | null
    location: { id: number; name: string | null; timezone: string }
    coach: string | null
    starts_at: string
    local: { date: string; start: string; end: string }
    status: string
  } | null
  attended_at: string | null
  /** Made by a recurring booking (US-04.08); `active` until it ends or is cancelled. */
  standing: { id: number; active: boolean } | null
  /** The guardian who pays for a child's booking (US-05.09). */
  payer: { id: number; name: string | null } | null
  /** The member who brought this guest (US-04.07). */
  host: { id: number; name: string | null } | null
  /** Moved here from another session (US-04.05). */
  rescheduled_from: { session_id: number; starts_at: string | null; timezone: string | null } | null
  channel: 'staff' | 'web' | 'app' | 'waitlist'
  entitlement_source: EntitlementSource | null
  /** Desk payment status, in lists and details (US-04.15). */
  payment_status?: PaymentStatus
  overridden: (OverridableCheck | 'cancellation_window')[]
  booked_by: string | null
  created_at: string | null
  cancelled_at: string | null
  penalty: Penalty | null
  penalty_fee: number | null
  penalty_waived: boolean
  no_show_at: string | null
  /** Marked by the scheduled job, not by staff. */
  no_show_automatic: boolean
  /** Marked less than 24 hours ago. */
  no_show_reversible: boolean
}

/** Where a booking can move (US-04.05), and whether it is past the free window. */
export interface RescheduleOptions extends Omit<CancellationTerms, 'can_waive'> {
  can_override: boolean
  sessions: {
    id: number
    location: { id: number; name: string }
    facility: string | null
    local: { date: string; start: string; end: string }
    capacity: number | null
    booked: number
    status: string
    booking: SessionDetails['booking']
  }[]
}

/** What cancelling a booking now means (US-04.04). */
export interface CancellationTerms {
  late: boolean
  free_until: string
  penalty: Penalty
  fee: number | null
  can_waive: boolean
}

/** Whether a client can book a session (US-04.01): every check in order, and why not. */
export interface BookingEligibility {
  ok: boolean
  reasons: {
    code: string
    check: EligibilityCheck
    message: string
    params: Record<string, string | number>
    overridable: boolean
  }[]
  checks: {
    check: EligibilityCheck
    passed: boolean
    overridden: boolean
    reasons: string[]
    params: Record<string, string | number>
  }[]
  can_waitlist: boolean
  entitlements: EntitlementSource[]
  /** Why the client's memberships/packages can't pay for it (US-06.04/05), when they hold some. */
  entitlement_note?: { code: string; message: string } | null
}

export type CancelReason = 'coach' | 'facility' | 'low_bookings' | 'holiday' | 'other'

/** A session with the conflicts it has now (Conflict Center, US-03.07). */
export interface ConflictCenterItem {
  session: CalendarSession
  issues: SessionConflictItem[]
}

/** A series' weekly pattern (US-03.05), for the edit form. */
export interface SeriesPattern {
  id: number
  weekdays: number[]
  every_weeks: number
  start_time: string
  duration: number
  starts_on: string
  ends_on: string | null
  rolling: boolean
}

export type SeriesUpdateInput = Omit<SessionInput, 'date'> & {
  from: string
  weekdays: number[]
  every_weeks: number
  ends: 'date' | 'never'
  ends_on: string | null
  skip_dates: string[]
}

export interface SeriesUpdateResult {
  updated: number
  created: number
  removed: number
  cancelled: number
  /** Booked occurrences a new schedule couldn't move. */
  unresolved: { id: number; date: string; start: string; bookings: number }[]
}

export interface SessionFormOptions {
  defaults: {
    duration: number
    capacity: number | null
    buffer_before: number
    buffer_after: number
  }
  timezone: string
  facilities: {
    id: number
    name: string
    capacity: number
    parent_id: number | null
    linked: boolean
  }[]
  coaches: { id: number; name: string }[]
}

export interface VatSettings {
  enabled: boolean
  prices_include_vat: boolean
  registration_number: string | null
  legal_name: string | null
  rate: string | null
  rates: { rate: string; effective_from: string; scheduled: boolean }[]
  today: string
}

export interface VatInput {
  enabled: boolean
  prices_include_vat: boolean
  rate: number | null
  effective_from: string | null
  registration_number: string | null
  legal_name: string | null
}

/** A holiday or special hours (US-01.07); dates are Y-m-d in the branch timezone. */
export interface HourOverride {
  id: number
  label: string
  start_date: string
  end_date: string
  closed: boolean
  hours: TimeRange[] | null
}

export type HourOverrideInput = Omit<HourOverride, 'id'> & { sessions?: FutureSessionsChoice }

/** A session a closure or deactivation would affect (filled in by EP-03). */
export interface AffectedSession {
  id: number
  title: string
  starts_at: string
  bookings: number
}

/** A branch's weekly opening hours (US-01.06); null hours: not set yet. */
export interface BusinessHours {
  hours: WeeklyHours | null
  timezone: string
}

export interface LocationStaffMember {
  id: number
  name: string
  email: string
  status: 'Invited' | 'Active'
  roles: string[]
}

/** Editable branch details (US-01.03). */
export interface LocationInput {
  name: string
  status: LocationStatus
  address: string
  timezone: string
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  description: string | null
}

export interface LocationDetails extends Location, LocationInput {
  photo_url: string | null
}

export interface StaffAccess {
  id: number
  name: string
  email: string
  status: 'Invited' | 'Active' | 'Deactivated'
  deactivated_at: string | null
  is_me: boolean
  roles: string[]
  scope: AccessScope
  owner: boolean
  /** false when a role applies to the whole organization: the assignment then has no effect */
  location_limited: boolean
  all_locations: boolean
  location_ids: number[]
}

/** Where a role's permissions apply: whole organization, assigned branches, or own sessions and clients. */
export type AccessScope = 'organization' | 'locations' | 'own'

export interface RoleSummary {
  id: number
  name: string
  system: boolean
  /** false for the Owner role, which can never change */
  editable: boolean
  scope: AccessScope
  users_count: number
  permissions: string[]
}

export interface RolesMatrix {
  roles: RoleSummary[]
  /** module => actions, in display order */
  modules: Record<string, string[]>
  scopes: AccessScope[]
}

export interface AuditEntry {
  id: number
  created_at: string
  actor: { id: number; name: string; email: string } | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_label: string | null
  old_values: Record<string, unknown> | null
  new_values: Record<string, unknown> | null
  ip_address: string | null
}

export interface AuditFilters {
  actor?: number | null
  action?: string | null
  entity_type?: string | null
  entity_id?: string | number | null
  from?: string | null
  to?: string | null
}

export interface AuditFilterOptions {
  actors: { id: number; name: string; email: string }[]
  actions: string[]
  entity_types: string[]
}

export interface RoleInput {
  name?: string
  scope?: AccessScope
  permissions?: string[]
}

/** The password was right but the account uses 2FA: answer with twoFactorChallenge(). */
export interface TwoFactorPending {
  two_factor: true
}

export type SignInResult = StaffUser | TwoFactorPending

export const needsTwoFactor = (result: SignInResult): result is TwoFactorPending =>
  'two_factor' in result

export interface TwoFactorStatus {
  enabled: boolean
  required: boolean
  recovery_codes_left: number
  recovery_codes?: string[]
}

export interface TwoFactorSetup {
  secret: string
  otpauth_url: string
  qr_svg: string
}

export interface SecuritySettings {
  two_factor_required_roles: string[]
  roles: string[]
}

/** Exactly one of the two: a 6-digit code from the app, or a recovery code. */
export type SecondFactor = { code: string } | { recovery_code: string }

export interface Invitation {
  name: string
  email: string
  role: string
  expires_at: string
}

/** The token and email from an emailed link (US-00.05). */
export interface EmailedLink {
  token: string
  email: string
}

export interface NewPassword {
  password: string
  password_confirmation: string
}

/** Drops empty filter values so they are not sent as `?actor=`. */
function cleanParams(params: object): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== null && v !== undefined && v !== ''),
  )
}

export const tenantApi = {
  async organization(): Promise<Organization> {
    return (await http.get('/api/organization')).data.data
  },
  async login(email: string, password: string, remember: boolean): Promise<SignInResult> {
    await csrfCookie()
    const { data } = await http.post('/api/auth/login', { email, password, remember })
    return data.two_factor ? data : data.data
  },
  async twoFactorChallenge(factor: SecondFactor): Promise<StaffUser> {
    return (await http.post('/api/auth/two-factor-challenge', factor)).data.data
  },
  /** The branch the user works in, kept on their account (US-01.13); null for all of them. */
  async setCurrentLocation(locationId: number | null): Promise<StaffUser> {
    return (await http.put('/api/account/current-location', { location_id: locationId })).data.data
  },
  async me(): Promise<StaffUser> {
    return (await http.get('/api/auth/me')).data.data
  },
  async logout(): Promise<void> {
    await http.post('/api/auth/logout')
  },
  /** null: follow the organization's language. */
  async updateProfile(profile: { locale: 'ar' | 'en' | null }): Promise<StaffUser> {
    return (await http.put('/api/account/profile', profile)).data.data
  },
  async forgotPassword(email: string): Promise<void> {
    await csrfCookie()
    await http.post('/api/auth/forgot-password', { email })
  },
  /** Resolves when the reset link can still be used; rejects with 410 otherwise. */
  async checkResetLink(link: EmailedLink): Promise<void> {
    await http.get('/api/auth/reset-password', { params: link })
  },
  async resetPassword(link: EmailedLink, password: NewPassword): Promise<SignInResult> {
    await csrfCookie()
    const { data } = await http.post('/api/auth/reset-password', { ...link, ...password })
    return data.two_factor ? data : data.data
  },
  async invitation(link: EmailedLink): Promise<Invitation> {
    return (await http.get('/api/invitation', { params: link })).data.data
  },
  async acceptInvitation(link: EmailedLink, password: NewPassword): Promise<StaffUser> {
    await csrfCookie()
    return (await http.post('/api/invitation/accept', { ...link, ...password })).data.data
  },
  twoFactor: {
    async status(): Promise<TwoFactorStatus> {
      return (await http.get('/api/account/two-factor')).data.data
    },
    async start(password: string): Promise<TwoFactorSetup> {
      return (await http.post('/api/account/two-factor', { password })).data.data
    },
    async confirm(code: string): Promise<TwoFactorStatus> {
      return (await http.post('/api/account/two-factor/confirm', { code })).data.data
    },
    async newRecoveryCodes(password: string): Promise<TwoFactorStatus> {
      return (await http.post('/api/account/two-factor/recovery-codes', { password })).data.data
    },
    async disable(password: string): Promise<TwoFactorStatus> {
      return (await http.delete('/api/account/two-factor', { data: { password } })).data.data
    },
  },
  /** Active branches, or archived ones (needs locations.delete). */
  async locations(archived = false, status?: LocationStatus): Promise<Location[]> {
    const params = { ...(archived ? { archived: 1 } : {}), ...(status ? { status } : {}) }
    return (await http.get('/api/locations', { params })).data.data
  },
  async location(id: number): Promise<LocationDetails> {
    return (await http.get(`/api/locations/${id}`)).data.data
  },
  async locationStaff(
    id: number,
  ): Promise<{ data: LocationStaffMember[]; all_locations_count: number }> {
    return (await http.get(`/api/locations/${id}/staff`)).data
  },
  async createLocation(input: Partial<LocationInput>): Promise<LocationDetails> {
    return (await http.post('/api/locations', input)).data.data
  },
  async updateLocation(id: number, input: LocationInput): Promise<LocationDetails> {
    return (await http.put(`/api/locations/${id}`, input)).data.data
  },
  async uploadLocationPhoto(id: number, file: File): Promise<LocationDetails> {
    const form = new FormData()
    form.append('photo', file)
    return (await http.post(`/api/locations/${id}/photo`, form)).data.data
  },
  async deleteLocationPhoto(id: number): Promise<void> {
    await http.delete(`/api/locations/${id}/photo`)
  },
  async deactivationImpact(id: number): Promise<DeactivationImpact> {
    return (await http.get(`/api/locations/${id}/deactivation`)).data.data
  },
  async deactivateLocation(
    id: number,
    choice: { future_sessions?: FutureSessionsChoice; reason?: string } = {},
  ): Promise<LocationDetails> {
    return (await http.post(`/api/locations/${id}/deactivate`, choice)).data.data
  },
  async activateLocation(id: number): Promise<LocationDetails> {
    return (await http.post(`/api/locations/${id}/activate`)).data.data
  },
  async businessHours(id: number): Promise<BusinessHours> {
    return (await http.get(`/api/locations/${id}/business-hours`)).data.data
  },
  async updateBusinessHours(id: number, hours: WeeklyHours | null): Promise<BusinessHours> {
    return (await http.put(`/api/locations/${id}/business-hours`, { hours })).data.data
  },
  facilities: {
    async list(params: { location_id?: number; archived?: boolean } = {}): Promise<Facility[]> {
      const query = { ...params, archived: params.archived ? 1 : undefined }
      return (await http.get('/api/facilities', { params: query })).data.data
    },
    async create(input: FacilityInput): Promise<Facility> {
      return (await http.post('/api/facilities', input)).data.data
    },
    async update(id: number, input: FacilityInput): Promise<Facility> {
      return (await http.put(`/api/facilities/${id}`, input)).data.data
    },
    async uploadPhoto(id: number, file: File): Promise<Facility> {
      const form = new FormData()
      form.append('photo', file)
      return (await http.post(`/api/facilities/${id}/photo`, form)).data.data
    },
    async deletePhoto(id: number): Promise<void> {
      await http.delete(`/api/facilities/${id}/photo`)
    },
    async archive(id: number): Promise<void> {
      await http.delete(`/api/facilities/${id}`)
    },
    async restore(id: number): Promise<Facility> {
      return (await http.post(`/api/facilities/${id}/restore`)).data.data
    },
    async get(id: number): Promise<Facility> {
      return (await http.get(`/api/facilities/${id}`)).data.data
    },
    async availability(id: number, from: string, to: string): Promise<FacilityAvailability> {
      return (await http.get(`/api/facilities/${id}/availability`, { params: { from, to } })).data
        .data
    },
    /** Local "Y-m-d H:i" times at the facility's branch. */
    async block(
      id: number,
      input: { title: string; starts_at: string; ends_at: string },
    ): Promise<FacilityReservation> {
      return (await http.post(`/api/facilities/${id}/blocks`, input)).data.data
    },
    async unblock(id: number, blockId: number): Promise<void> {
      await http.delete(`/api/facilities/${id}/blocks/${blockId}`)
    },
  },
  serviceCategories: {
    async list(archived = false): Promise<ServiceCategory[]> {
      return (
        await http.get('/api/service-categories', { params: archived ? { archived: 1 } : {} })
      ).data.data
    },
    async create(input: ServiceCategoryInput): Promise<ServiceCategory> {
      return (await http.post('/api/service-categories', input)).data.data
    },
    async update(id: number, input: ServiceCategoryInput): Promise<ServiceCategory> {
      return (await http.put(`/api/service-categories/${id}`, input)).data.data
    },
    async reorder(ids: number[]): Promise<ServiceCategory[]> {
      return (await http.put('/api/service-categories/order', { ids })).data.data
    },
    async archive(id: number): Promise<ServiceCategory> {
      return (await http.post(`/api/service-categories/${id}/archive`)).data.data
    },
    async restore(id: number): Promise<ServiceCategory> {
      return (await http.post(`/api/service-categories/${id}/restore`)).data.data
    },
    async remove(id: number): Promise<void> {
      await http.delete(`/api/service-categories/${id}`)
    },
  },
  sessions: {
    async options(serviceId: number, locationId: number): Promise<SessionFormOptions> {
      return (
        await http.get('/api/sessions/options', {
          params: { service_id: serviceId, location_id: locationId },
        })
      ).data.data
    },
    async check(input: SessionInput): Promise<SessionConflictItem[]> {
      return (await http.post('/api/sessions/check', input)).data.data.conflicts
    },
    async create(input: SessionInput): Promise<CalendarSession> {
      return (await http.post('/api/sessions', input)).data.data
    },
    async checkUpdate(id: number, input: SessionInput): Promise<SessionConflictItem[]> {
      return (await http.post(`/api/sessions/${id}/check`, input)).data.data.conflicts
    },
    async update(id: number, input: SessionInput & { scope?: 'one' }): Promise<CalendarSession> {
      return (await http.put(`/api/sessions/${id}`, input)).data.data
    },
    async substitutes(id: number): Promise<SubstituteCandidate[]> {
      return (await http.get(`/api/sessions/${id}/substitutes`)).data.data
    },
    async substitute(
      id: number,
      input: { coach_id: number; notify: boolean; confirm_warnings?: boolean },
    ): Promise<CalendarSession> {
      return (await http.post(`/api/sessions/${id}/substitute`, input)).data.data
    },
    async setStatus(input: {
      ids?: number[]
      series_id?: number
      status: 'Published' | 'Draft'
    }): Promise<{ changed: number; skipped: { id: number; reason: string }[]; found: number }> {
      return (await http.post('/api/sessions/status', input)).data.data
    },
    async get(id: number): Promise<SessionDetails> {
      return (await http.get(`/api/sessions/${id}`)).data.data
    },
    async cancel(
      id: number,
      input: { reason: CancelReason; note: string | null },
    ): Promise<CalendarSession> {
      return (await http.post(`/api/sessions/${id}/cancel`, input)).data.data
    },
    async cancelPreview(input: CancelTarget): Promise<{
      sessions: number
      bookings: number
      waitlist: number
    }> {
      return (await http.post('/api/sessions/cancel/preview', input)).data.data
    },
    async cancelMany(
      input: CancelTarget & { reason: CancelReason; note: string | null },
    ): Promise<{ cancelled: number; bookings: number }> {
      return (await http.post('/api/sessions/cancel', input)).data.data
    },
    async conflicts(params: { location_id?: number } = {}): Promise<{
      data: ConflictCenterItem[]
      meta: { sessions: number; hard: number; soft: number; issues: number }
    }> {
      return (await http.get('/api/sessions/conflicts', { params })).data
    },
    async series(id: number): Promise<SeriesPattern> {
      return (await http.get(`/api/session-series/${id}`)).data.data
    },
    async updateSeries(id: number, input: SeriesUpdateInput): Promise<SeriesUpdateResult> {
      return (await http.put(`/api/session-series/${id}`, input)).data.data
    },
    async previewSeries(input: SeriesInput): Promise<SeriesPreviewItem[]> {
      return (await http.post('/api/session-series/preview', input)).data.data
    },
    async createSeries(
      input: SeriesInput,
    ): Promise<{ id: number; sessions: number; skipped: number; rolling: boolean }> {
      return (await http.post('/api/session-series', input)).data.data
    },
    async list(
      filters: CalendarFilters,
    ): Promise<{ data: CalendarSession[]; branches: CalendarBranch[] }> {
      const { mine, ...rest } = filters
      return (
        await http.get('/api/sessions', {
          params: { ...rest, ...(mine === undefined ? {} : { mine: mine ? 1 : 0 }) },
        })
      ).data
    },
  },
  clients: {
    async list(params: ClientFilters & { page?: number; per_page?: number } = {}): Promise<{
      data: Client[]
      meta: { total: number; current_page: number; last_page: number }
    }> {
      return (await http.get('/api/clients', { params })).data
    },
    /** The filtered list as CSV (clients.export); opened as a download link. */
    exportUrl(filters: ClientFilters): string {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, String(v)))
        else params.append(key, String(value))
      }
      return `/api/clients/export?${params}`
    },
    async get(id: number): Promise<Client> {
      return (await http.get(`/api/clients/${id}`)).data.data
    },
    async create(input: ClientInput): Promise<Client> {
      return (await http.post('/api/clients', input)).data.data
    },
    /** Edits the details (US-05.05); 409 client_duplicate when the mobile or email is another client's. */
    async update(id: number, input: ClientInput): Promise<Client> {
      return (await http.put(`/api/clients/${id}`, input)).data.data
    },
    /** Header alerts and the Overview tab (US-05.05). */
    async overview(id: number): Promise<ClientOverview> {
      return (await http.get(`/api/clients/${id}/overview`)).data.data
    },
    async payments(id: number): Promise<Payment[]> {
      return (await http.get(`/api/clients/${id}/payments`)).data.data
    },
    async timeline(
      id: number,
      params: { type?: TimelineType; page?: number } = {},
    ): Promise<{ data: TimelineEvent[]; meta: { current_page: number; last_page: number } }> {
      return (await http.get(`/api/clients/${id}/timeline`, { params })).data
    },
    async duplicates(params: {
      mobile?: string | null
      email?: string | null
      ignore?: number | null
    }): Promise<ClientMatch[]> {
      return (await http.get('/api/clients/duplicates', { params })).data.data
    },
    /** Guardians and children (US-05.08). */
    /** The client's memberships and packages (EP-06), current first. */
    async entitlements(id: number): Promise<ClientEntitlement[]> {
      return (await http.get(`/api/clients/${id}/entitlements`)).data.data
    },
    async family(id: number): Promise<ClientFamily> {
      return (await http.get(`/api/clients/${id}/family`)).data.data
    },
    /** Deactivate, reactivate, block (reason needed) or unblock (US-05.13). */
    async setStatus(
      id: number,
      action: 'deactivate' | 'reactivate' | 'block' | 'unblock',
      reason?: string | null,
    ): Promise<Client> {
      return (await http.post(`/api/clients/${id}/status`, { action, reason })).data.data
    },
    /** A privacy deletion request: the personal data is anonymized, history is kept. */
    async anonymize(id: number, reason: string): Promise<Client> {
      return (await http.post(`/api/clients/${id}/anonymize`, { reason, confirm: true })).data.data
    },
    /** Both profiles side by side and what would move (US-05.14). */
    async mergePreview(id: number, secondaryId: number): Promise<MergePreview> {
      return (
        await http.get(`/api/clients/${id}/merge-preview`, {
          params: { secondary_id: secondaryId },
        })
      ).data.data
    },
    /** Merges `secondaryId` into `id`; irreversible. */
    async merge(
      id: number,
      secondaryId: number,
      fields: Record<string, 'primary' | 'secondary'>,
    ): Promise<Client> {
      return (
        await http.post(`/api/clients/${id}/merge`, {
          secondary_id: secondaryId,
          fields,
          confirm: true,
        })
      ).data.data
    },
    async notes(id: number): Promise<ClientNote[]> {
      return (await http.get(`/api/clients/${id}/notes`)).data.data
    },
    async addNote(
      id: number,
      input: Pick<ClientNote, 'body' | 'visibility' | 'pinned'>,
    ): Promise<ClientNote> {
      return (await http.post(`/api/clients/${id}/notes`, input)).data.data
    },
    async updateNote(
      noteId: number,
      input: Pick<ClientNote, 'body' | 'visibility' | 'pinned'>,
    ): Promise<ClientNote> {
      return (await http.put(`/api/notes/${noteId}`, input)).data.data
    },
    async deleteNote(noteId: number): Promise<void> {
      await http.delete(`/api/notes/${noteId}`)
    },
    async noteHistory(noteId: number): Promise<
      {
        body: string
        visibility: ClientNote['visibility']
        edited_by: string | null
        edited_at: string
      }[]
    > {
      return (await http.get(`/api/notes/${noteId}/history`)).data.data
    },
    async familyPage(id: number): Promise<FamilyPage> {
      return (await http.get(`/api/clients/${id}/family-page`)).data.data
    },
    async addChild(
      guardianId: number,
      input: {
        first_name: string
        last_name: string
        date_of_birth: string | null
        gender: 'female' | 'male' | null
        relation: FamilyLink['relation']
        permissions?: Partial<Record<GuardianPermission, boolean>>
      },
    ): Promise<ClientFamily & { child_id: number }> {
      return (await http.post(`/api/clients/${guardianId}/children`, input)).data.data
    },
    /** `as: 'dependent'` links `clientId` as this client's child; `as: 'guardian'` as their guardian. */
    async linkFamily(
      id: number,
      input: { client_id: number; as: 'dependent' | 'guardian'; relation: FamilyLink['relation'] },
    ): Promise<ClientFamily> {
      return (await http.post(`/api/clients/${id}/family/link`, input)).data.data
    },
    async updateGuardianship(
      linkId: number,
      input: Partial<Pick<FamilyLink, 'relation' | GuardianPermission>>,
    ): Promise<FamilyLink> {
      return (await http.put(`/api/guardianships/${linkId}`, input)).data.data
    },
    async unlinkFamily(linkId: number): Promise<void> {
      await http.delete(`/api/guardianships/${linkId}`)
    },
    async health(id: number): Promise<ClientHealth> {
      return (await http.get(`/api/clients/${id}/health`)).data.data
    },
    async updateEmergencyContacts(
      id: number,
      contacts: { name: string; relation: string; phone: string }[],
    ): Promise<ClientHealth> {
      return (await http.put(`/api/clients/${id}/emergency-contacts`, { contacts })).data.data
    },
    async updateHealthNotes(id: number, healthNotes: string | null): Promise<ClientHealth> {
      return (await http.put(`/api/clients/${id}/health-notes`, { health_notes: healthNotes })).data
        .data
    },
    async uploadPhoto(id: number, file: File): Promise<Client> {
      const body = new FormData()
      body.append('photo', file)
      return (await http.post(`/api/clients/${id}/photo`, body)).data.data
    },
  },
  /** Membership plans and packages (US-06.01/02/07); managing them needs memberships.update. */
  membershipPlans: {
    async list(params: { kind?: PlanKind } = {}): Promise<MembershipPlan[]> {
      return (await http.get('/api/membership-plans', { params })).data.data
    },
    async get(id: number): Promise<MembershipPlanDetails> {
      return (await http.get(`/api/membership-plans/${id}`)).data.data
    },
    async holders(
      id: number,
      page = 1,
    ): Promise<{
      data: PlanHolder[]
      meta: { total: number; current_page: number; last_page: number }
    }> {
      return (await http.get(`/api/membership-plans/${id}/holders`, { params: { page } })).data
    },
    async create(input: MembershipPlanInput): Promise<MembershipPlan> {
      return (await http.post('/api/membership-plans', input)).data.data
    },
    async update(id: number, input: MembershipPlanInput): Promise<MembershipPlan> {
      return (await http.put(`/api/membership-plans/${id}`, input)).data.data
    },
  },
  /** Import clients from CSV or Excel (US-05.15). */
  imports: {
    templateUrl: '/api/client-imports/template',
    async upload(file: File): Promise<ClientImport> {
      const body = new FormData()
      body.append('file', file)
      return (await http.post('/api/client-imports', body)).data.data
    },
    async get(id: number): Promise<ClientImport> {
      return (await http.get(`/api/client-imports/${id}`)).data.data
    },
    async preview(
      id: number,
      mapping: Record<string, number | null>,
      duplicates: 'skip' | 'update',
    ): Promise<ImportPreview> {
      return (await http.post(`/api/client-imports/${id}/preview`, { mapping, duplicates })).data
        .data
    },
    async run(
      id: number,
      mapping: Record<string, number | null>,
      duplicates: 'skip' | 'update',
    ): Promise<ClientImport> {
      return (await http.post(`/api/client-imports/${id}/run`, { mapping, duplicates })).data.data
    },
  },
  /** Tags and segments (US-05.12). */
  tags: {
    async list(): Promise<Tag[]> {
      return (await http.get('/api/tags')).data.data
    },
    async create(input: { name: string; color?: string | null }): Promise<Tag> {
      return (await http.post('/api/tags', input)).data.data
    },
    async update(id: number, input: { name: string; color?: string | null }): Promise<Tag> {
      return (await http.put(`/api/tags/${id}`, input)).data.data
    },
    async remove(id: number): Promise<void> {
      await http.delete(`/api/tags/${id}`)
    },
    /** Replaces the client's tags. */
    async setForClient(clientId: number, tagIds: number[]): Promise<Tag[]> {
      return (await http.put(`/api/clients/${clientId}/tags`, { tag_ids: tagIds })).data.data
    },
    async bulk(tagId: number, clientIds: number[]): Promise<{ tagged: number }> {
      return (await http.post('/api/clients/bulk-tag', { tag_id: tagId, client_ids: clientIds }))
        .data.data
    },
  },
  segments: {
    async list(): Promise<Segment[]> {
      return (await http.get('/api/segments')).data.data
    },
    async create(input: {
      name: string
      type: Segment['type']
      rules?: SegmentRules
    }): Promise<Segment> {
      return (await http.post('/api/segments', input)).data.data
    },
    async update(
      id: number,
      input: { name: string; type: Segment['type']; rules?: SegmentRules },
    ): Promise<Segment> {
      return (await http.put(`/api/segments/${id}`, input)).data.data
    },
    async remove(id: number): Promise<void> {
      await http.delete(`/api/segments/${id}`)
    },
    /** "312 clients match" while building the rules. */
    async preview(rules: SegmentRules): Promise<number> {
      return (await http.post('/api/segments/preview', { rules })).data.data.count
    },
    /** Adds clients to a static segment. */
    async addMembers(id: number, clientIds: number[]): Promise<{ count: number }> {
      return (await http.post(`/api/segments/${id}/members`, { client_ids: clientIds })).data.data
    },
  },
  /** Settings → Waivers and clients signing them (US-05.07). */
  waivers: {
    async list(): Promise<WaiverTemplate[]> {
      return (await http.get('/api/waivers')).data.data
    },
    async get(id: number): Promise<WaiverTemplate> {
      return (await http.get(`/api/waivers/${id}`)).data.data
    },
    async create(input: {
      name: Translated
      required_for: WaiverTemplate['required_for']
      service_ids?: number[]
      content: Translated
    }): Promise<WaiverTemplate> {
      return (await http.post('/api/waivers', input)).data.data
    },
    async update(
      id: number,
      input: {
        name: Translated
        required_for: WaiverTemplate['required_for']
        service_ids?: number[]
        status: WaiverTemplate['status']
      },
    ): Promise<WaiverTemplate> {
      return (await http.put(`/api/waivers/${id}`, input)).data.data
    },
    /** A new text; `requires_resign` asks existing clients to sign again. */
    async publish(
      id: number,
      content: Translated,
      requiresResign: boolean,
    ): Promise<WaiverTemplate> {
      return (
        await http.post(`/api/waivers/${id}/publish`, { content, requires_resign: requiresResign })
      ).data.data
    },
    async forClient(clientId: number): Promise<ClientWaiverStatus> {
      return (await http.get(`/api/clients/${clientId}/waivers`)).data.data
    },
    async toSign(
      clientId: number,
      templateId: number,
    ): Promise<{
      template_id: number
      name: Translated
      version: number
      content: Translated
      client: { id: number; name: string; minor: boolean }
    }> {
      return (await http.get(`/api/clients/${clientId}/waivers/${templateId}`)).data.data
    },
    async sign(
      clientId: number,
      templateId: number,
      input: {
        signer_name: string
        method: 'typed' | 'drawn'
        accepted: boolean
        signature?: string | null
        guardian_client_id?: number | null
      },
    ): Promise<WaiverSignature> {
      return (await http.post(`/api/clients/${clientId}/waivers/${templateId}/sign`, input)).data
        .data
    },
    async signedCopy(
      clientId: number,
      signatureId: number,
    ): Promise<
      WaiverSignature & {
        name: string
        content: Translated
        signature: string | null
        ip_address: string | null
      }
    > {
      return (await http.get(`/api/clients/${clientId}/signed-waivers/${signatureId}`)).data.data
    },
  },
  /** Desk payments (US-04.15): never edited or deleted, only voided with a reason. */
  payments: {
    async forBooking(bookingId: number): Promise<BookingPayments> {
      return (await http.get(`/api/bookings/${bookingId}/payments`)).data.data
    },
    /** `amount` is what the client paid, VAT included; a reference is needed for transfers and card terminals. */
    async record(
      bookingId: number,
      input: {
        amount: number
        method: PaymentMethod
        reference?: string | null
        note?: string | null
      },
    ): Promise<Payment> {
      return (await http.post(`/api/bookings/${bookingId}/payments`, input)).data.data
    },
    async void(id: number, reason: string): Promise<Payment> {
      return (await http.post(`/api/payments/${id}/void`, { reason })).data.data
    },
    async receipt(id: number): Promise<Receipt> {
      return (await http.get(`/api/payments/${id}/receipt`)).data.data
    },
  },
  /** Staff manage a session's waitlist (US-04.13). */
  waitlist: {
    /** Books a waiting client; a full session needs `override` with bookings.override and a reason. */
    async promote(
      entryId: number,
      input: { override?: boolean; override_reason?: string | null } = {},
    ): Promise<Booking> {
      return (await http.post(`/api/waitlist/${entryId}/promote`, input)).data.data
    },
    async remove(entryId: number, reason: string): Promise<void> {
      await http.post(`/api/waitlist/${entryId}/remove`, { reason })
    },
    /** Every Waiting entry, first in line first; 409 waitlist_changed when out of date. */
    async reorder(sessionId: number, entryIds: number[]): Promise<void> {
      await http.put(`/api/sessions/${sessionId}/waitlist/order`, { entry_ids: entryIds })
    },
    async settings(
      sessionId: number,
      values: Partial<
        Record<
          'waitlist_enabled' | 'waitlist_max_size' | 'waitlist_mode' | 'waitlist_closes_minutes',
          boolean | number | string | null
        >
      >,
    ): Promise<void> {
      await http.put(`/api/sessions/${sessionId}/waitlist/settings`, values)
    },
  },
  bookings: {
    async list(params: BookingFilters & { page?: number; per_page?: number }): Promise<{
      data: Booking[]
      meta: { total: number; current_page: number; last_page: number }
    }> {
      return (await http.get('/api/bookings', { params })).data
    },
    async filterOptions(): Promise<{
      services: { id: number; name: string }[]
      coaches: { id: number; name: string }[]
      locations: { id: number; name: string }[]
    }> {
      return (await http.get('/api/bookings/filters')).data.data
    },
    async get(id: number): Promise<BookingDetails> {
      return (await http.get(`/api/bookings/${id}`)).data.data
    },
    /** Cancel (with a reason) or mark attended; refused ones come back with why. */
    async bulk(input: {
      action: 'cancel' | 'attend'
      ids: number[]
      reason?: string
    }): Promise<{ done: number; failed: { id: number; code: string; message: string }[] }> {
      return (await http.post('/api/bookings/bulk', input)).data.data
    },
    /** The filtered list as CSV (reports.export); opened as a download link. */
    exportUrl(filters: BookingFilters): string {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(filters)) {
        if (value === undefined || value === null || value === '') continue
        if (Array.isArray(value)) value.forEach((v) => params.append(`${key}[]`, String(v)))
        else params.append(key, String(value))
      }
      return `/api/bookings/export?${params}`
    },
    async eligibility(
      sessionId: number,
      input: { client_id: number; override?: OverridableCheck[]; override_reason?: string | null },
    ): Promise<BookingEligibility> {
      return (await http.post(`/api/sessions/${sessionId}/eligibility`, input)).data.data
    },
    async rescheduleOptions(id: number): Promise<RescheduleOptions> {
      return (await http.get(`/api/bookings/${id}/reschedule-options`)).data.data
    },
    /** The new booking; 409 reschedule_late / not_eligible (with `eligibility`) / reschedule_other_service. */
    async reschedule(
      id: number,
      input: {
        session_id: number
        override?: OverridableCheck[]
        override_window?: boolean
        override_reason?: string | null
      },
    ): Promise<Booking> {
      return (await http.post(`/api/bookings/${id}/reschedule`, input)).data.data
    },
    /** 409 no_show_not_allowed unless Confirmed and the session started. */
    async markNoShow(id: number): Promise<Booking> {
      return (await http.post(`/api/bookings/${id}/no-show`)).data.data
    },
    /** 409 no_show_not_reversible after 24 hours. */
    async reverseNoShow(id: number, reason: string): Promise<Booking> {
      return (await http.post(`/api/bookings/${id}/no-show/reverse`, { reason })).data.data
    },
    async cancelTerms(id: number): Promise<CancellationTerms> {
      return (await http.get(`/api/bookings/${id}/cancel-terms`)).data.data
    },
    /** 409 booking_not_cancellable / booking_session_started; waiving needs bookings.override. */
    async cancel(
      id: number,
      input: { reason?: string | null; waive_penalty?: boolean; waive_reason?: string | null },
    ): Promise<Booking> {
      return (await http.post(`/api/bookings/${id}/cancel`, input)).data.data
    },
    /** Books a client into every upcoming occurrence of a series (US-04.08). */
    async createRecurring(input: {
      client_id: number
      series_id: number
      starts_on: string
      ends_on: string | null
      until_entitlement_ends: boolean
      entitlement_source: EntitlementSource
    }): Promise<RecurringBooking> {
      return (await http.post('/api/bookings/recurring', input)).data.data
    },
    /** "Cancel all future": ends the recurring booking and cancels its upcoming bookings. */
    async cancelRecurring(id: number): Promise<{ cancelled: number }> {
      return (await http.post(`/api/bookings/recurring/${id}/cancel`)).data.data
    },
    /** 409 waitlist_disabled / waitlist_not_needed / waitlist_closed / waitlist_full / already_waitlisted / not_eligible. */
    async joinWaitlist(
      sessionId: number,
      input: { client_id: number; entitlement_source: EntitlementSource },
    ): Promise<WaitlistEntry> {
      return (await http.post(`/api/sessions/${sessionId}/waitlist`, input)).data.data
    },
    /** How a member's guest can be paid for in a session, and what the service restricts (US-04.07). */
    async guestOptions(sessionId: number, hostId: number): Promise<GuestOptions> {
      return (
        await http.get('/api/bookings/guest-options', {
          params: { session_id: sessionId, host_client_id: hostId },
        })
      ).data.data
    },
    /** Books a member's guest; 409 not_eligible / host_not_eligible, 422 validation. */
    async createGuest(input: {
      session_id: number
      host_client_id: number
      guest: {
        first_name: string
        last_name: string
        mobile: string | null
        email: string | null
        gender: 'female' | 'male' | null
        date_of_birth: string | null
      }
      entitlement_source: EntitlementSource
      override?: OverridableCheck[]
      override_reason?: string | null
    }): Promise<Booking> {
      return (await http.post('/api/bookings/guest', input)).data.data
    },
    /** 409 not_eligible carries `eligibility`; 422 entitlement_unavailable. */
    async create(input: {
      session_id: number
      client_id: number
      /** A guardian paying for their child's booking (US-05.09). */
      payer_client_id?: number | null
      entitlement_source: EntitlementSource
      override?: OverridableCheck[]
      override_reason?: string | null
    }): Promise<Booking> {
      return (await http.post('/api/bookings', input)).data.data
    },
  },
  mySchedule: {
    async schedule(from: string, days = 14): Promise<MySchedule> {
      return (await http.get('/api/me/schedule', { params: { from, days } })).data.data
    },
    async newCalendarFeed(): Promise<{ url: string }> {
      return (await http.post('/api/me/calendar-feed')).data.data
    },
    async revokeCalendarFeed(): Promise<void> {
      await http.delete('/api/me/calendar-feed')
    },
  },
  appointments: {
    async slots(params: {
      service_id: number
      location_id: number
      from: string
      days?: number
      coach_id?: number | null
    }): Promise<{
      data: AppointmentDay[]
      meta: { duration: number; interval: number; timezone: string }
    }> {
      return (await http.get('/api/appointments/slots', { params })).data
    },
    async book(input: {
      service_id: number
      location_id: number
      coach_id: number
      facility_id?: number | null
      date: string
      start_time: string
      confirm_warnings?: boolean
    }): Promise<CalendarSession> {
      return (await http.post('/api/appointments', input)).data.data
    },
  },
  events: {
    async create(input: EventInput): Promise<ScheduledEventDetails> {
      return (await http.post('/api/events', input)).data.data
    },
    async get(id: number): Promise<ScheduledEventDetails> {
      return (await http.get(`/api/events/${id}`)).data.data
    },
  },
  programs: {
    async list(params: { location_id?: number; status?: ServiceStatus } = {}): Promise<Program[]> {
      return (await http.get('/api/programs', { params })).data.data
    },
    async get(id: number): Promise<Program> {
      return (await http.get(`/api/programs/${id}`)).data.data
    },
    async create(input: ProgramInput): Promise<Program> {
      return (await http.post('/api/programs', input)).data.data
    },
    async update(id: number, input: ProgramInput): Promise<Program> {
      return (await http.put(`/api/programs/${id}`, input)).data.data
    },
  },
  services: {
    async list(
      params: {
        location_id?: number
        category_id?: number
        activity_type?: ActivityType
        status?: ServiceStatus
        search?: string
      } = {},
    ): Promise<Service[]> {
      return (await http.get('/api/services', { params })).data.data
    },
    /** Publish, archive or add to a branch (US-02.10); returns the services changed. */
    async bulk(
      ids: number[],
      action: 'publish' | 'archive' | 'add_location',
      locationId: number | null = null,
    ): Promise<Service[]> {
      return (await http.post('/api/services/bulk', { ids, action, location_id: locationId })).data
        .data
    },
    async get(id: number): Promise<Service> {
      return (await http.get(`/api/services/${id}`)).data.data
    },
    async archiveImpact(id: number): Promise<DeactivationImpact> {
      return (await http.get(`/api/services/${id}/archive-impact`)).data.data
    },
    async archive(
      id: number,
      choice: { future_sessions?: FutureSessionsChoice; reason?: string } = {},
    ): Promise<Service> {
      return (await http.post(`/api/services/${id}/archive`, choice)).data.data
    },
    async restore(id: number): Promise<Service> {
      return (await http.post(`/api/services/${id}/restore`)).data.data
    },
    async staffOptions(): Promise<StaffOption[]> {
      return (await http.get('/api/services/staff-options')).data.data
    },
    async create(input: ServiceInput): Promise<Service> {
      return (await http.post('/api/services', input)).data.data
    },
    async update(id: number, input: ServiceInput): Promise<Service> {
      return (await http.put(`/api/services/${id}`, input)).data.data
    },
    async uploadPhoto(id: number, file: File): Promise<Service> {
      const form = new FormData()
      form.append('photo', file)
      return (await http.post(`/api/services/${id}/photo`, form)).data.data
    },
    async deletePhoto(id: number): Promise<void> {
      await http.delete(`/api/services/${id}/photo`)
    },
  },
  vat: {
    async get(locationId: number): Promise<VatSettings> {
      return (await http.get(`/api/locations/${locationId}/vat`)).data.data
    },
    async update(locationId: number, input: VatInput): Promise<VatSettings> {
      return (await http.put(`/api/locations/${locationId}/vat`, input)).data.data
    },
  },
  hourOverrides: {
    async list(locationId: number): Promise<HourOverride[]> {
      return (await http.get(`/api/locations/${locationId}/hour-overrides`)).data.data
    },
    async create(locationId: number, input: HourOverrideInput): Promise<HourOverride> {
      return (await http.post(`/api/locations/${locationId}/hour-overrides`, input)).data.data
    },
    async update(locationId: number, id: number, input: HourOverrideInput): Promise<HourOverride> {
      return (await http.put(`/api/locations/${locationId}/hour-overrides/${id}`, input)).data.data
    },
    async remove(locationId: number, id: number): Promise<void> {
      await http.delete(`/api/locations/${locationId}/hour-overrides/${id}`)
    },
  },
  async archiveLocation(id: number): Promise<void> {
    await http.delete(`/api/locations/${id}`)
  },
  async restoreLocation(id: number): Promise<Location> {
    return (await http.post(`/api/locations/${id}/restore`)).data.data
  },
  async users(): Promise<StaffAccess[]> {
    return (await http.get('/api/users')).data.data
  },
  async updateUserLocations(
    id: number,
    access: { all_locations: boolean; location_ids: number[] },
  ): Promise<StaffAccess> {
    return (await http.put(`/api/users/${id}/locations`, access)).data.data
  },
  async deactivateUser(id: number): Promise<StaffAccess> {
    return (await http.post(`/api/users/${id}/deactivate`)).data.data
  },
  async reactivateUser(id: number): Promise<StaffAccess> {
    return (await http.post(`/api/users/${id}/reactivate`)).data.data
  },
  async auditLogs(
    filters: AuditFilters,
    page: number,
  ): Promise<{ data: AuditEntry[]; meta: { total: number; per_page: number } }> {
    return (await http.get('/api/audit-logs', { params: { ...cleanParams(filters), page } })).data
  },
  async auditFilterOptions(): Promise<AuditFilterOptions> {
    return (await http.get('/api/audit-logs/filters')).data.data
  },
  auditExportUrl(filters: AuditFilters): string {
    return `/api/audit-logs/export?${new URLSearchParams(cleanParams(filters) as Record<string, string>)}`
  },
  async roles(): Promise<RolesMatrix> {
    const { data } = await http.get('/api/roles')
    return { roles: data.data, modules: data.modules, scopes: data.scopes }
  },
  async createRole(input: Required<RoleInput>): Promise<RoleSummary> {
    return (await http.post('/api/roles', input)).data.data
  },
  async updateRole(id: number, input: RoleInput): Promise<RoleSummary> {
    return (await http.put(`/api/roles/${id}`, input)).data.data
  },
  async resetRole(id: number): Promise<RoleSummary> {
    return (await http.post(`/api/roles/${id}/reset`)).data.data
  },
  async deleteRole(id: number): Promise<void> {
    await http.delete(`/api/roles/${id}`)
  },
  organizationProfile: {
    async get(): Promise<OrganizationProfile> {
      return (await http.get('/api/settings/organization')).data.data
    },
    async update(profile: OrganizationProfile): Promise<OrganizationProfile> {
      return (await http.put('/api/settings/organization', profile)).data.data
    },
    async uploadLogo(file: File): Promise<OrganizationProfile> {
      const form = new FormData()
      form.append('logo', file)
      return (await http.post('/api/settings/organization/logo', form)).data.data
    },
    async deleteLogo(): Promise<void> {
      await http.delete('/api/settings/organization/logo')
    },
  },
  regional: {
    async get(): Promise<{
      data: RegionalSettings & { currency_locked: boolean }
      options: {
        currencies: string[]
        locales: string[]
        date_formats: string[]
        time_formats: string[]
      }
    }> {
      return (await http.get('/api/settings/regional')).data
    },
    async update(
      settings: RegionalSettings,
    ): Promise<RegionalSettings & { currency_locked: boolean }> {
      return (await http.put('/api/settings/regional', settings)).data.data
    },
  },
  bookingPolicy: {
    async get(): Promise<{ data: OrganizationBookingPolicy; options: BookingPolicyOptions }> {
      return (await http.get('/api/settings/booking-policy')).data
    },
    async update(policy: OrganizationBookingPolicy): Promise<OrganizationBookingPolicy> {
      return (await http.put('/api/settings/booking-policy', policy)).data.data
    },
    async forLocation(
      id: number,
    ): Promise<{ data: LocationBookingPolicy; options: BookingPolicyOptions }> {
      return (await http.get(`/api/locations/${id}/booking-policy`)).data
    },
    async updateLocation(
      id: number,
      overrides: BookingPolicyOverrides,
    ): Promise<LocationBookingPolicy> {
      return (await http.put(`/api/locations/${id}/booking-policy`, overrides)).data.data
    },
    async forService(
      id: number,
      locationId: number | null,
    ): Promise<{ data: ServiceBookingPolicy; options: BookingPolicyOptions }> {
      const params = locationId ? { location_id: locationId } : {}
      return (await http.get(`/api/services/${id}/booking-policy`, { params })).data
    },
    async updateService(
      id: number,
      overrides: BookingPolicyOverrides,
      locationId: number | null,
    ): Promise<ServiceBookingPolicy> {
      const params = locationId ? { location_id: locationId } : {}
      return (await http.put(`/api/services/${id}/booking-policy`, overrides, { params })).data.data
    },
  },
  security: {
    async get(): Promise<SecuritySettings> {
      return (await http.get('/api/settings/security')).data.data
    },
    async update(requiredRoles: string[]): Promise<SecuritySettings> {
      return (
        await http.put('/api/settings/security', { two_factor_required_roles: requiredRoles })
      ).data.data
    },
  },
}
