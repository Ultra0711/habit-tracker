export function fmtDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr() {
  return fmtDate(new Date());
}

// Monday = 0 .. Sunday = 6, for display/grid columns
export function isoDow(d) {
  return (d.getDay() + 6) % 7;
}

// Sunday = 0, JS native — used when checking habit.scheduledDays
export function jsDow(d) {
  return d.getDay();
}

export function startOfWeek(offset) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const idx = isoDow(now);
  const monday = new Date(now);
  monday.setDate(now.getDate() - idx + offset * 7);
  return monday;
}

export function getWeekDates(offset) {
  const monday = startOfWeek(offset);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LABELS_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
