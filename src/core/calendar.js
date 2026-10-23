const DAY = 86_400_000;
const MAX_DAYS = 378;

function integer(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative safe integer.`);
  }
  return value;
}

function dateValue(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new TypeError('Contribution dates must use YYYY-MM-DD.');
  }
  const value = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(value) || new Date(value).toISOString().slice(0, 10) !== date) {
    throw new TypeError('Invalid contribution date.');
  }
  return value;
}

/** Sort dates, derive UTC weekdays, fill internal gaps, and group Sunday-first weeks. */
export function calendarFromDays(username, days, totalContributions) {
  if (typeof username !== 'string' || username.length > 100) {
    throw new TypeError('Calendar username must be a string of at most 100 characters.');
  }
  if (!Array.isArray(days) || days.length > MAX_DAYS) {
    throw new TypeError('Calendar must contain at most 378 days.');
  }
  const byDate = new Map();
  let sum = 0;
  for (const day of days) {
    if (!day || typeof day !== 'object') throw new TypeError('Invalid contribution day.');
    const value = dateValue(day.date);
    if (byDate.has(value)) throw new TypeError('Calendar contains duplicate dates.');
    const count = integer(day.contributionCount, 'Contribution count');
    const level = integer(day.contributionLevel, 'Contribution level');
    if (level > 4) throw new TypeError('Contribution level must be between 0 and 4.');
    if (day.weekday !== undefined && (!Number.isInteger(day.weekday) || day.weekday < 0 || day.weekday > 6)) {
      throw new TypeError('Weekday must be between 0 and 6.');
    }
    sum = integer(sum + count, 'Contribution total');
    byDate.set(value, {
      date: day.date,
      contributionCount: count,
      contributionLevel: count === 0 ? 0 : Math.max(1, level),
      weekday: new Date(value).getUTCDay(),
    });
  }
  const total = totalContributions === undefined ? sum : integer(totalContributions, 'Contribution total');
  if (!byDate.size) return { username, totalContributions: total, weeks: [] };
  const dates = [...byDate.keys()].sort((a, b) => a - b);
  const first = dates[0];
  const last = dates[dates.length - 1];
  const start = first - new Date(first).getUTCDay() * DAY;
  if ((last - first) / DAY >= MAX_DAYS || Math.floor((last - start) / (7 * DAY)) >= 54) {
    throw new RangeError('Calendar must fit within 54 weeks.');
  }
  const weeks = [];
  for (let value = first; value <= last; value += DAY) {
    const week = Math.floor((value - start) / (7 * DAY));
    weeks[week] ??= { contributionDays: [] };
    weeks[week].contributionDays.push(byDate.get(value) ?? {
      date: new Date(value).toISOString().slice(0, 10),
      contributionCount: 0,
      contributionLevel: 0,
      weekday: new Date(value).getUTCDay(),
    });
  }
  return { username, totalContributions: total, weeks };
}

export function normalizeCalendar(calendar) {
  if (!calendar || typeof calendar !== 'object' || !Array.isArray(calendar.weeks) || calendar.weeks.length > 54) {
    throw new TypeError('Calendar must contain an array of at most 54 weeks.');
  }
  const days = calendar.weeks.flatMap((week) => {
    if (!week || !Array.isArray(week.contributionDays) || week.contributionDays.length > 7) {
      throw new TypeError('Each calendar week must contain at most seven contribution days.');
    }
    return week.contributionDays;
  });
  return calendarFromDays(calendar.username ?? '', days, calendar.totalContributions);
}

/** A reproducible, Sunday-first calendar for the complete leap year 2024. */
export function createDemoCalendar(seed = 42) {
  if (!Number.isSafeInteger(seed)) throw new TypeError('Demo seed must be a safe integer.');
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4_294_967_296;
  };
  const days = [];
  for (let i = 0; i < 366; i++) {
    const value = Date.UTC(2024, 0, 1) + i * DAY;
    const weekday = new Date(value).getUTCDay();
    const active = random() > (weekday === 0 || weekday === 6 ? 0.53 : 0.23);
    const count = active ? 1 + Math.floor(random() * 16) : 0;
    days.push({ date: new Date(value).toISOString().slice(0, 10), contributionCount: count,
      contributionLevel: count === 0 ? 0 : Math.min(4, Math.ceil(count / 4)), weekday });
  }
  return calendarFromDays('octocat', days);
}
