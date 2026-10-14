import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { i18n, setLocale } from '@/i18n'
import BookingPaymentsPanel from '../BookingPaymentsPanel.vue'
import { tenantApi, type BookingPayments } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

vi.mock('@/api/tenant', () => ({
  tenantApi: { payments: { forBooking: vi.fn(), record: vi.fn(), void: vi.fn() } },
}))

// jsdom has no matchMedia (Select).
window.matchMedia ??= ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => {},
  removeEventListener: () => {},
})) as unknown as typeof window.matchMedia

const terms = (over: Partial<BookingPayments> = {}): BookingPayments => ({
  currency: 'SAR',
  required: true,
  price: 150,
  net: 150,
  vat: 22.5,
  rate: '15.00',
  due: 172.5,
  paid: 100,
  balance: 72.5,
  status: 'partial',
  payments: [],
  ...over,
})

// The dialog renders inline; the date picker needs a browser.
const stubs = {
  DatePicker: true,
  Dialog: defineComponent({
    props: { visible: Boolean },
    setup:
      (props, { slots }) =>
      () =>
        props.visible ? h('div', [slots.default?.(), slots.footer?.()]) : null,
  }),
}

function render() {
  setActivePinia(createPinia())
  useStaffAuth().can = (p: string) => ['payments.view', 'payments.create'].includes(p)
  return mount(BookingPaymentsPanel, {
    props: { bookingId: 9 },
    global: { plugins: [i18n, PrimeVue, ToastService], stubs },
  })
}

describe('BookingPaymentsPanel (US-04.15, US-07.03)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('shows what is due and records the rest, needing a reference for a transfer', async () => {
    vi.mocked(tenantApi.payments.forBooking).mockResolvedValue(terms())
    vi.mocked(tenantApi.payments.record).mockResolvedValue({
      amount: 72.5,
      receipt_number: 'R-000002',
    } as never)
    const wrapper = render()
    await flushPromises()

    expect(wrapper.text()).toContain('Partially paid')
    expect(wrapper.text()).toContain('Left to pay')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Record payment')!
      .trigger('click')

    // The branch's methods (defaults here) in a dropdown.
    wrapper.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 'bank_transfer')
    await flushPromises()
    const save = () =>
      wrapper
        .findAll('button')
        .filter((b) => b.text() === 'Record payment')
        .reverse()[0]!
    expect(save().attributes('disabled')).toBeDefined() // reference needed
    await wrapper.get('#pay-ref').setValue('TRX-889')
    await save().trigger('click')
    await flushPromises()

    expect(tenantApi.payments.record).toHaveBeenCalledWith(9, {
      amount: 72.5,
      method: 'bank_transfer',
      reference: 'TRX-889',
      note: null,
      paid_on: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    })
  })
})
