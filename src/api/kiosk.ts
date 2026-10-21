import { csrfCookie, http } from '@/lib/http'

/** The self check-in kiosk's API (US-08.05), signed in by the device token, not a staff login. */
export interface KioskInfo {
  organization: string
  logo_url: string | null
  location: { id: number; name: string; timezone: string }
  device: string
}
export interface KioskBooking {
  id: number
  client: { id: number; first_name: string | null; self: boolean }
  session: { id: number; service: string; time: string; facility: string | null }
  checked_in: boolean
  can_check_in: boolean
  /** Codes only: the screen shows no personal details. */
  denials: string[]
}
export interface KioskIdentity {
  session: string
  expires_in: number
  client: { first_name: string; photo: string | null }
  bookings: KioskBooking[]
}

const headers = (token: string) => ({ 'X-Kiosk-Token': token })

export const kioskApi = {
  async info(token: string): Promise<KioskInfo> {
    await csrfCookie()
    return (await http.get('/api/kiosk', { headers: headers(token) })).data.data
  },
  async identify(
    token: string,
    input: { code: string } | { mobile: string; pin: string },
  ): Promise<KioskIdentity> {
    return (await http.post('/api/kiosk/identify', input, { headers: headers(token) })).data.data
  },
  async checkIn(token: string, session: string, bookingId: number): Promise<KioskBooking[]> {
    return (
      await http.post(
        '/api/kiosk/check-in',
        { session, booking_id: bookingId },
        { headers: headers(token) },
      )
    ).data.data.bookings
  },
}
