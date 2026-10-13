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
    clients: { list: vi.fn() },
    bookings: { eligibility: vi.fn(), create: vi.fn() },
  },
}))

const session = {
  id: 7,
  service: { name: 'Yoga Flow' },
  location: { name: 'Olaya' },
  local: { date: '2030-11-04', start: '18:00', end: '19:00' },
} as unknown as CalendarSession

const sara = { id: 3, name: 'Sara Ali', member_id: 'M-10001', photo_url: null }

const eligibility = (ok: boolean): BookingEligibility => ({
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
  can_waitlist: !ok,
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
