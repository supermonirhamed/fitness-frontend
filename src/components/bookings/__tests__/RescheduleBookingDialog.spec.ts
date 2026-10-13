import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import RescheduleBookingDialog from '../RescheduleBookingDialog.vue'
import { tenantApi, type Booking, type RescheduleOptions } from '@/api/tenant'

vi.mock('@/api/tenant', () => ({
  tenantApi: { bookings: { rescheduleOptions: vi.fn(), reschedule: vi.fn() } },
}))

// jsdom has no ResizeObserver (Textarea auto-resize).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const booking = { id: 9, client: { name: 'Sara Ali' } } as Booking
type Slot = RescheduleOptions['sessions'][number]
const slot = (id: number, can_book: boolean, reason: Slot['booking']['reason'] = null): Slot => ({
  id,
  location: { id: 1, name: 'Olaya' },
  facility: 'Studio',
  local: { date: '2030-11-05', start: '18:00', end: '19:00' },
  capacity: 10,
  booked: can_book ? 3 : 10,
  status: 'Published',
  booking: {
    state: can_book ? 'available' : 'full',
    can_book,
    can_waitlist: false,
    reason,
    params: {},
  },
})
const options = (over: Partial<RescheduleOptions>): RescheduleOptions => ({
  late: false,
  free_until: '2030-11-04T03:00:00Z',
  penalty: 'none',
  fee: null,
  can_override: false,
  sessions: [slot(21, true), slot(22, false, 'full')],
  ...over,
})

const stubs = {
  Dialog: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', [slots.default?.(), slots.footer?.()]),
  }),
}

async function open(o: RescheduleOptions) {
  setActivePinia(createPinia())
  vi.mocked(tenantApi.bookings.rescheduleOptions).mockResolvedValue(o)
  vi.mocked(tenantApi.bookings.reschedule).mockResolvedValue({ ...booking, id: 10 } as Booking)
  const wrapper = mount(RescheduleBookingDialog, {
    props: { booking, session: 'Mon 18:00', timezone: 'Asia/Riyadh', visible: false },
    global: { plugins: [i18n, PrimeVue], stubs },
  })
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return wrapper
}

const submit = (w: Awaited<ReturnType<typeof open>>) =>
  w.findAll('button').filter((b) => b.text() !== 'Cancel')[0]!

describe('RescheduleBookingDialog', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('moves the booking to a picked session of the same service (US-04.05)', async () => {
    const wrapper = await open(options({}))
    const radios = wrapper.findAll('input[type="radio"]')
    expect(radios[1]!.attributes('disabled')).toBeDefined() // full, no override

    await radios[0]!.setValue(true)
    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.reschedule).toHaveBeenCalledWith(9, {
      session_id: 21,
      override: [],
      override_window: false,
      override_reason: null,
    })
    expect(wrapper.emitted('moved')).toHaveLength(1)
  })

  it('needs an override reason once the free window has passed', async () => {
    const wrapper = await open(options({ late: true, can_override: true }))
    expect(wrapper.text()).toContain('Moving the booking now needs an override')

    await wrapper.findAll('input[type="radio"]')[0]!.setValue(true)
    expect(submit(wrapper).attributes('disabled')).toBeDefined()
    await wrapper.get('#reschedule-reason').setValue('Doctor’s note')
    await submit(wrapper).trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.reschedule).toHaveBeenCalledWith(9, {
      session_id: 21,
      override: [],
      override_window: true,
      override_reason: 'Doctor’s note',
    })
  })
})
