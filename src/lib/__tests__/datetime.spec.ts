import { describe, expect, it } from 'vitest'
import { formatDate, formatTime, mixesZones, zoneAbbreviation } from '../datetime'

// 21:30 UTC on 8 Oct = 00:30 on 9 Oct in Riyadh (UTC+3).
const moment = new Date(Date.UTC(2026, 9, 8, 21, 30))

describe('formatDate', () => {
  it('follows the chosen pattern in the given timezone', () => {
    expect(formatDate(moment, 'dd/MM/yyyy', 'Asia/Riyadh', 'en')).toBe('09/10/2026')
    expect(formatDate(moment, 'MM/dd/yyyy', 'Asia/Riyadh', 'en')).toBe('10/09/2026')
    expect(formatDate(moment, 'yyyy-MM-dd', 'UTC', 'en')).toBe('2026-10-08')
    expect(formatDate(moment, 'dd MMM yyyy', 'Asia/Riyadh', 'en')).toBe('09 Oct 2026')
  })

  it('uses Western digits and Arabic month names in Arabic', () => {
    expect(formatDate(moment, 'dd/MM/yyyy', 'Asia/Riyadh', 'ar')).toBe('09/10/2026')
    expect(formatDate(moment, 'dd MMM yyyy', 'Asia/Riyadh', 'ar')).toMatch(/^09 \S+ 2026$/)
  })
})

describe('formatTime', () => {
  it('uses the 12- or 24-hour clock, and can show the zone', () => {
    const plain = (s: string) => s.replace(/\u202f|\u00a0/g, ' ')
    expect(plain(formatTime(moment, '12h', 'Asia/Riyadh', 'en'))).toBe('12:30 AM')
    expect(formatTime(moment, '24h', 'Asia/Riyadh', 'en')).toBe('00:30')
    expect(formatTime(moment, '24h', 'Asia/Riyadh', 'en', true)).toBe('00:30 GMT+3')
  })
})

describe('zones', () => {
  it('names zones and detects screens that mix them', () => {
    expect(zoneAbbreviation('Asia/Riyadh', 'en', moment)).toBe('GMT+3')
    expect(mixesZones(['Asia/Riyadh', 'Asia/Riyadh'])).toBe(false)
    expect(mixesZones(['Asia/Riyadh', 'Asia/Dubai'])).toBe(true)
  })
})
