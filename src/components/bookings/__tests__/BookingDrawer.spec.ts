import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import BookingDrawer from '../BookingDrawer.vue'
import { tenantApi, type BookingEligibility, type CalendarSession } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

vi.mock('@/api/tenant', () => ({
  tenantApi: {
    clients: {
      list: vi.fn(),
      family: vi.fn().mockResolvedValue({ is_child: false, guardians: [], dependents: [] }),
    },
    bookings: { eligibility: vi.fn(), create: vi.fn(), joinWaitlist: vi.fn() },
  },
}))

// jsdom has no matchMedia (DatePicker).
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof window.matchMedia

const session = {
  id: 7,
  service: { name: 'Yoga Flow' },
  location: { name: 'Olaya' },
  local: { date: '2030-11-04', start: '18:00', end: '19:00' },
  series_id: 31,
} as unknown as CalendarSession

const sara = { id: 3, name: 'Sara Ali', first_name: 'Sara', member_id: 'M-10001', photo_url: null }

const eligibility = (ok: boolean, canWaitlist = false): BookingEligibility => ({
  ok,
  reasons: ok
    ? []
    : [
        {
          code: 'session_full',
          check: 'capacity',
          message: 'This session is full (1/1).',
          params: {},
          overridable: true,
        },
      ],
  checks: [
    {
      check: 'capacity',
      passed: ok,
      overridden: false,
      reasons: ok ? [] : ['session_full'],
      params: {},
    },
  ],
  can_waitlist: canWaitlist,
  entitlements: ['pay_at_desk', 'complimentary'],
})

// Overlays render inline; the client search hands back Sara when picked.
const stubs = {
  Drawer: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.header?.(), slots.default?.(), slots.footer?.()]),
  }),
  AutoComplete: defineComponent({
    emits: ['option-select'],
    setup:
      (_, { emit }) =>
      () =>
        h('button', { class: 'pick', onClick: () => emit('option-select', { value: sara }) }),
  }),
  NewClientDrawer: true,
  OverrideDialog: true,
}

function render(permissions: string[]) {
  setActivePinia(createPinia())
  const auth = useStaffAuth()
  auth.can = (p: string) => permissions.includes(p)
  return mount(BookingDrawer, {
    props: { session, visible: true },
    global: { plugins: [i18n, PrimeVue], stubs, directives: { tooltip: {} } },
  })
}

const confirmButton = (wrapper: ReturnType<typeof render>) =>
  wrapper.findAll('button').find((b) => b.text() === 'Confirm booking')!

describe('BookingDrawer', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('checks eligibility for the picked client and books with the chosen payment (US-04.02)', async () => {
    vi.mocked(tenantApi.bookings.eligibility).mockResolvedValue(eligibility(true))
    vi.mocked(tenantApi.bookings.create).mockResolvedValue({ id: 1 } as never)
    const wrapper = render(['bookings.create'])

    await wrapper.get('.pick').trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.eligibility).toHaveBeenCalledWith(7, {
      client_id: 3,
      override: [],
      override_reason: null,
    })
    expect(wrapper.text()).toContain('Sara Ali')
    expect(wrapper.text()).toContain('The client pays at the front desk.')

    await confirmButton(wrapper).trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.create).toHaveBeenCalledWith({
      session_id: 7,
      client_id: 3,
      payer_client_id: null,
      entitlement_source: 'pay_at_desk',
      override: [],
      override_reason: null,
    })
    expect(wrapper.emitted('booked')).toHaveLength(1)
  })

  it('blocks a client who is not eligible, offering an override only to permitted staff', async () => {
    vi.mocked(tenantApi.bookings.eligibility).mockResolvedValue(eligibility(false))

    const desk = render(['bookings.create'])
    await desk.get('.pick').trigger('click')
    await flushPromises()
    expect(desk.text()).toContain('This session is full (1/1).')
    expect(desk.text()).toContain('A manager can override this with a reason.')
    expect(confirmButton(desk).attributes('disabled')).toBeDefined()

    const manager = render(['bookings.create', 'bookings.override'])
    await manager.get('.pick').trigger('click')
    await flushPromises()
    expect(manager.findAll('button').some((b) => b.text() === 'Override capacity')).toBe(true)
  })
})

describe('BookingDrawer, guest of a member (US-04.07)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('books the member’s guest with their name and contact, paid as a drop-in', async () => {
    tenantApi.bookings.guestOptions = vi.fn().mockResolvedValue({
      entitlements: ['drop_in'],
      restrictions: { gender: 'Male', age_min: null, age_max: null },
    })
    tenantApi.bookings.createGuest = vi.fn().mockResolvedValue({ id: 5 })
    const wrapper = render(['bookings.create'])

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Guest of a member')!
      .trigger('click')
    await wrapper.get('.pick').trigger('click') // the member: Sara
    await flushPromises()
    expect(tenantApi.bookings.eligibility).not.toHaveBeenCalled()

    await wrapper.get('#guest-first').setValue('Noor')
    await wrapper.get('#guest-last').setValue('Saleh')
    expect(confirmButton(wrapper).attributes('disabled')).toBeDefined() // contact needed
    await wrapper.get('#guest-mobile').setValue('0551234567')
    // A men-only service: the guest's gender is needed to check them.
    expect(confirmButton(wrapper).attributes('disabled')).toBeDefined()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Male')!
      .trigger('click')
    await confirmButton(wrapper).trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.createGuest).toHaveBeenCalledWith({
      session_id: 7,
      host_client_id: 3,
      guest: {
        first_name: 'Noor',
        last_name: 'Saleh',
        mobile: '0551234567',
        email: null,
        gender: 'male',
        date_of_birth: null,
      },
      entitlement_source: 'drop_in',
      override: [],
      override_reason: null,
    })
    expect(wrapper.emitted('booked')).toHaveLength(1)
  })
})

describe('BookingDrawer, every session of the series (US-04.08)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('makes a recurring booking and shows what was booked and skipped', async () => {
    vi.mocked(tenantApi.bookings.eligibility).mockResolvedValue(eligibility(true))
    tenantApi.bookings.createRecurring = vi.fn().mockResolvedValue({
      id: 4,
      status: 'Active',
      starts_on: '2030-11-04',
      ends_on: null,
      until_entitlement_ends: true,
      summary: {
        booked: [{ session_id: 7, date: '2030-11-04', start: '18:00', booking_id: 1 }],
        skipped: [
          {
            session_id: 8,
            date: '2030-11-11',
            start: '18:00',
            reasons: [{ code: 'session_full', message: 'This session is full (10/10).' }],
          },
        ],
        waitlisted: [],
      },
    })
    const wrapper = render(['bookings.create'])
    await wrapper.get('.pick').trigger('click')
    await flushPromises()

    await wrapper.get('#booking-repeat').setValue(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Book the series')!
      .trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.createRecurring).toHaveBeenCalledWith({
      client_id: 3,
      series_id: 31,
      starts_on: '2030-11-04',
      ends_on: null,
      until_entitlement_ends: true,
      entitlement_source: 'pay_at_desk',
    })
    expect(wrapper.text()).toContain('Booked: 1 sessions')
    expect(wrapper.text()).toContain('This session is full (10/10).')
    expect(wrapper.emitted('recurring')).toHaveLength(1)
  })
})

describe('BookingDrawer, full session (US-04.10)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('offers the waitlist as the main action and says the client’s place', async () => {
    vi.mocked(tenantApi.bookings.eligibility).mockResolvedValue(eligibility(false, true))
    vi.mocked(tenantApi.bookings.joinWaitlist).mockResolvedValue({ id: 2, place: 1 } as never)
    const wrapper = render(['bookings.create'])
    await wrapper.get('.pick').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Sara will be #1 on the waitlist')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Add to waitlist')!
      .trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.joinWaitlist).toHaveBeenCalledWith(7, {
      client_id: 3,
      entitlement_source: 'pay_at_desk',
    })
    expect(wrapper.emitted('waitlisted')).toHaveLength(1)
  })
})

describe('BookingDrawer, booking for a child (US-05.09)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('checks and books the child, with the guardian as payer', async () => {
    vi.mocked(tenantApi.clients.family).mockResolvedValue({
      is_child: false,
      guardians: [],
      dependents: [
        {
          id: 1,
          relation: 'mother',
          can_book: true,
          can_pay: true,
          can_view_performance: true,
          receives_notifications: true,
          client: {
            id: 9,
            name: 'Yousef Ali',
            member_id: null,
            age: 9,
            status: 'Active',
            photo_url: null,
          },
        },
      ],
    })
    vi.mocked(tenantApi.bookings.eligibility).mockResolvedValue(eligibility(true))
    vi.mocked(tenantApi.bookings.create).mockResolvedValue({ id: 1 } as never)
    const wrapper = render(['bookings.create'])
    await wrapper.get('.pick').trigger('click')
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Yousef Ali (child)')!
      .trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Yousef attends · Sara pays')
    expect(tenantApi.bookings.eligibility).toHaveBeenLastCalledWith(
      7,
      expect.objectContaining({ client_id: 9 }),
    )

    await confirmButton(wrapper).trigger('click')
    await flushPromises()
    expect(tenantApi.bookings.create).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: 9, payer_client_id: 3 }),
    )
  })
})
