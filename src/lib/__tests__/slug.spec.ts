import { describe, expect, it } from 'vitest'
import { slugify } from '../slug'

describe('slugify', () => {
  it('turns a name into a url-safe subdomain', () => {
    expect(slugify('Elite Club – Olaya')).toBe('elite-club-olaya')
    expect(slugify('  Café Fit!! ')).toBe('cafe-fit')
  })

  it('returns empty for names without latin characters', () => {
    expect(slugify('نادي النخبة')).toBe('')
  })

  it('caps the length at 40 without a trailing hyphen', () => {
    const slug = slugify('a'.repeat(39) + ' bbb')
    expect(slug.length).toBeLessThanOrEqual(40)
    expect(slug.endsWith('-')).toBe(false)
  })
})
