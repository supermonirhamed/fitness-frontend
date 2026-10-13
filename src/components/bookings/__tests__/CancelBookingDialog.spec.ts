import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import CancelBookingDialog from '../CancelBookingDialog.vue'
import { tenantApi, type Booking, type CancellationTerms } from '@/api/tenant'

vi.mock('@/api/tenant', () => ({
  tenantApi: { bookings: { cancelTerms: vi.fn(), cancel: vi.fn(), cancelRecurring: vi.fn() } },
}))

// jsdom has no ResizeObserver (Textarea auto-resize).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

const booking = { id: 9, client: { name: 'Sara Ali' } } as Booking
const terms = (over: Partial<CancellationTerms>): CancellationTerms => ({
  late: false,
  free_until: '2030-11-04T03:00:00Z',
  penalty: 'none',
  fee: null,
  can_waive: false,
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

async function open(t: CancellationTerms, b: Booking = booking) {
  setActivePinia(createPinia())
  vi.mocked(tenantApi.bookings.cancelTerms).mockResolvedValue(t)
  vi.mocked(tenantApi.bookings.cancel).mockResolvedValue({
    ...booking,
    status: 'LateCancel',
  } as Booking)
  const wrapper = mount(CancelBookingDialog, {
    props: { booking: b, session: 'Yoga Flow', timezone: 'Asia/Riyadh', visible: false },
    global: { plugins: [i18n, PrimeVue], stubs },
  })
  await wrapper.setProps({ visible: true })
  await flushPromises()
  return wrapper
}

const button = (w: Awaited<ReturnType<typeof open>>, label: string) =>
  w.findAll('button').find((b) => b.text() === label)!

describe('CancelBookingDialog', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('says a cancellation is free inside the window (US-04.04)', async () => {
    const wrapper = await open(terms({}))
    expect(wrapper.text()).toContain('Free cancellation until')
    expect(wrapper.text()).not.toContain('Waive the penalty')
  })

  it('warns about a late cancel and its penalty, and lets permitted staff waive it with a reason', async () => {
    const wrapper = await open(terms({ late: true, penalty: 'consume_credit', can_waive: true }))
    expect(wrapper.text()).toContain('This is a late cancellation')
    expect(wrapper.text()).toContain('the credit or visit of this booking is used up')

    await wrapper.get('#cancel-waive').setValue(true)
    expect(button(wrapper, 'Cancel booking').attributes('disabled')).toBeDefined() // reason needed
    await wrapper.get('#cancel-waive-reason').setValue('Doctor’s note')
    await button(wrapper, 'Cancel booking').trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.cancel).toHaveBeenCalledWith(9, {
      reason: null,
      waive_penalty: true,
      waive_reason: 'Doctor’s note',
    })
    expect(wrapper.emitted('cancelled')).toHaveLength(1)
  })

  it('stops a recurring booking with "this and all future sessions" (US-04.08)', async () => {
    vi.mocked(tenantApi.bookings.cancelRecurring).mockResolvedValue({ cancelled: 6 })
    const wrapper = await open(terms({}), {
      ...booking,
      standing: { id: 4, active: true },
    } as Booking)

    await wrapper.findAll('input[name="cancel-scope"]')[1]!.setValue(true)
    await button(wrapper, 'Cancel booking').trigger('click')
    await flushPromises()

    expect(tenantApi.bookings.cancelRecurring).toHaveBeenCalledWith(4)
    expect(tenantApi.bookings.cancel).not.toHaveBeenCalled()
    expect(wrapper.emitted('cancelledFuture')).toEqual([[6]])
  })
})
