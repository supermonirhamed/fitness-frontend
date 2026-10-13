import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { i18n, setLocale } from '@/i18n'
import ClientTimeline from '../ClientTimeline.vue'
import { tenantApi } from '@/api/tenant'

vi.mock('@/api/tenant', () => ({ tenantApi: { clients: { timeline: vi.fn() } } }))

describe('ClientTimeline (US-05.06)', () => {
  beforeEach(() => {
    setLocale('en')
    setActivePinia(createPinia())
    vi.mocked(tenantApi.clients.timeline).mockResolvedValue({
      data: [
        {
          id: 2,
          action: 'booking.cancelled',
          type: 'cancellations',
          at: null,
          user: 'Lama',
          values: { session: 'Yoga', reason: 'Travel' },
        },
        { id: 1, action: 'client.created', type: 'profile', at: null, user: 'Lama', values: {} },
      ],
      meta: { current_page: 1, last_page: 1 },
    })
  })

  it('lists events with what, why and who, and filters by type', async () => {
    const wrapper = mount(ClientTimeline, {
      props: { clientId: 5 },
      global: { plugins: [i18n, PrimeVue] },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('Booking cancelled')
    expect(wrapper.text()).toContain('Yoga · Travel')
    expect(wrapper.text()).toContain('Client created')

    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Payments')!
      .trigger('click')
    await flushPromises()
    expect(tenantApi.clients.timeline).toHaveBeenLastCalledWith(5, { type: 'payments', page: 1 })
  })
})
