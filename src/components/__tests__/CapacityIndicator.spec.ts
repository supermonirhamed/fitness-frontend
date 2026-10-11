import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { i18n, setLocale } from '@/i18n'
import CapacityIndicator from '../patterns/CapacityIndicator.vue'

const render = (props: Record<string, unknown>) =>
  mount(CapacityIndicator, { props, global: { plugins: [i18n] } })

describe('CapacityIndicator', () => {
  it('shows the capacity states in colour and in words (US-03.15)', () => {
    setLocale('en')
    const cases: [Record<string, unknown>, string, string][] = [
      [{ booked: 7, capacity: 10 }, 'cap--available', '7 of 10 booked · Available'],
      [{ booked: 8, capacity: 10 }, 'cap--almost', '8 of 10 booked · Almost full'],
      [{ booked: 10, capacity: 10 }, 'cap--full', '10 of 10 booked · Full'],
      [
        { booked: 10, capacity: 10, waitlist: 3 },
        'cap--full',
        '10 of 10 booked · Full · 3 waiting',
      ],
      [
        { booked: 4, capacity: 10, cancelled: true },
        'cap--cancelled',
        '4 of 10 booked · Cancelled',
      ],
    ]
    for (const [props, cls, label] of cases) {
      const root = render(props).get('[role="img"]')
      expect(root.classes()).toContain(cls)
      expect(root.attributes('aria-label')).toBe(label)
    }
  })

  it('marks a full session and its waitlist count', () => {
    setLocale('en')
    const text = render({ booked: 15, capacity: 15, waitlist: 3 }).text()
    expect(text).toContain('15 / 15')
    expect(text).toContain('Full')
    expect(text).toContain('+3')
  })
})
