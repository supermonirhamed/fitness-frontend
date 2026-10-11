// Calendar maths (US-03.01). Days are plain "YYYY-MM-DD" strings in a branch's timezone (D4), so
// a day never shifts with the browser's zone; Intl converts them to UTC instants for the API.

/** "YYYY-MM-DD" of an instant in a timezone. */
export function ymdIn(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const todayIn = (timeZone: string) => ymdIn(new Date(), timeZone)

function parse(ymd: string): [number, number, number] {
  const [y, m, d] = ymd.split('-').map(Number)
  return [y!, m!, d!]
}

export function addDays(ymd: string, days: number): string {
  const [y, m, d] = parse(ymd)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(ymd: string): number {
  const [y, m, d] = parse(ymd)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** First day of the week containing `ymd`, the week starting on `weekStart` (org setting). */
export function startOfWeek(ymd: string, weekStart: number): string {
  return addDays(ymd, -((weekday(ymd) - weekStart + 7) % 7))
}

export function startOfMonth(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`
}

export function addMonths(ymd: string, months: number): string {
  const [y, m] = parse(ymd)
  return new Date(Date.UTC(y, m - 1 + months, 1)).toISOString().slice(0, 10)
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetMinutes(at: number, timeZone: string): number {
  const p: Record<string, number> = {}
  for (const part of new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(new Date(at))) {
    if (part.type !== 'literal') p[part.type] = Number(part.value)
  }
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!)
  return Math.round((asUtc - at) / 60000)
}

/** The UTC instant of a local wall-clock time in a timezone (DST-safe). */
export function zonedToUtc(ymd: string, time: string, timeZone: string): Date {
  const [y, m, d] = parse(ymd)
  const [h, min] = time.split(':').map(Number)
  const wall = Date.UTC(y, m - 1, d, h!, min!)
  let at = wall - offsetMinutes(wall, timeZone) * 60000
  at = wall - offsetMinutes(at, timeZone) * 60000 // second pass across a DST change
  return new Date(at)
}

/** "HH:MM" → minutes since midnight; "24:00" is 1440. */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(':').map(Number)
  return h! * 60 + m!
}

export const fromMinutes = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

export interface Laid<T> {
  item: T
  lane: number
  lanes: number
}

/**
 * Side-by-side lanes for overlapping items in one column (design: CalendarScreen withLanes):
 * each item gets the first free lane, and every item in an overlapping cluster shares its width.
 */
export function layoutLanes<T>(
  items: T[],
  start: (i: T) => number,
  end: (i: T) => number,
): Laid<T>[] {
  const sorted = [...items].sort((a, b) => start(a) - start(b) || end(b) - end(a))
  const out: Laid<T>[] = []
  let cluster: Laid<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length)
    cluster.forEach((c) => (c.lanes = lanes))
    cluster = []
    laneEnds = []
  }
  for (const item of sorted) {
    if (start(item) >= clusterEnd) flush()
    let lane = laneEnds.findIndex((e) => e <= start(item))
    if (lane < 0) {
      lane = laneEnds.length
      laneEnds.push(0)
    }
    laneEnds[lane] = end(item)
    clusterEnd = Math.max(clusterEnd, end(item))
    const laid = { item, lane, lanes: 1 }
    cluster.push(laid)
    out.push(laid)
  }
  flush()
  return out
}
