import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import PrimeVue from 'primevue/config'
import ToastService from 'primevue/toastservice'
import { i18n, setLocale } from '@/i18n'
import WaitlistPanel from '../WaitlistPanel.vue'
import { tenantApi, type SessionDetails, type WaitlistEntry } from '@/api/tenant'
import { useStaffAuth } from '@/stores/staffAuth'

vi.mock('@/api/tenant', () => ({
  tenantApi: {
    waitlist: { promote: vi.fn(), remove: vi.fn(), reorder: vi.fn(), settings: vi.fn() },
  },
}))

const entry = (id: number, name: string, place: number): WaitlistEntry => ({
  id,
  session_id: 7,
  client: { id: id + 100, name, member_id: null, photo_url: null },
  status: 'Waiting',
  place,
  entitlement_source: 'pay_at_desk',
  booking_id: null,
  reason: null,
  added_by: 'Lama',
  joined_at: '2030-11-01T10:00:00Z',
  closed_at: null,
})

const session = {
  id: 7,
  locked: false,
  capacity: 1,
  booked: 1,
  location: { timezone: 'Asia/Riyadh' },
  policy: {
    waitlist_enabled: true,
    waitlist_mode: 'automatic',
    waitlist_max_size: 0,
    waitlist_closes_minutes: 60,
  },
  session_policy: {},
  waitlist_entries: [entry(1, 'Huda Ali', 1), entry(2, 'Reem Ali', 2)],
} as unknown as SessionDetails

// Overlays render inline; the reason dialog confirms with a fixed reason.
const stubs = {
  Dialog: true,
  OverrideDialog: defineComponent({
    props: { visible: Boolean, title: String },
    emits: ['confirm'],
    setup:
      (props, { emit }) =>
      () =>
        props.visible
          ? h('button', { class: 'reason', onClick: () => emit('confirm', 'Regular') }, props.title)
          : null,
  }),
  RouterLink: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('a', slots.default?.()),
  }),
}

function render(permissions: string[]) {
  setActivePinia(createPinia())
  useStaffAuth().can = (p: string) => permissions.includes(p)
  return mount(WaitlistPanel, {
    props: { session },
    global: { plugins: [i18n, PrimeVue, ToastService], stubs, directives: { tooltip: {} } },
  })
}

describe('WaitlistPanel (US-04.13)', () => {
  beforeEach(() => {
    setLocale('en')
    vi.clearAllMocks()
  })

  it('moves a client down the queue', async () => {
    const wrapper = render(['bookings.update', 'bookings.create'])
    await wrapper.get('[aria-label="Move Huda Ali down"]').trigger('click')
    await flushPromises()

    expect(tenantApi.waitlist.reorder).toHaveBeenCalledWith(7, [2, 1])
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })

  it('promotes over capacity with a reason when the session is full', async () => {
    const wrapper = render(['bookings.update', 'bookings.create', 'bookings.override'])
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Promote now')!
      .trigger('click')
    expect(tenantApi.waitlist.promote).not.toHaveBeenCalled() // asks for a reason first

    await wrapper.get('.reason').trigger('click')
    await flushPromises()
    expect(tenantApi.waitlist.promote).toHaveBeenCalledWith(1, {
      override: true,
      override_reason: 'Regular',
    })
  })
})
