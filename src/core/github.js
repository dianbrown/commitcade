import { calendarFromDays, normalizeCalendar } from './calendar.js';

const LEVELS = Object.freeze({ NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 });
const QUERY = `query ContributionCalendar($username: String!) {
  user(login: $username) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel weekday } }
      }
    }
  }
}`;

/** GitHub handles: 1–39 ASCII alphanumerics with single interior hyphens. */
export function validateUsername(username) {
  return typeof username === 'string' && username.length <= 39
    && /^[a-z\d]+(?:-[a-z\d]+)*$/i.test(username);
}

function abortError() {
  const error = new Error('Contribution request was cancelled.');
  error.name = 'AbortError';
  return error;
}

/** Tokenless requests use the public API; tokens are sent only to GitHub GraphQL. */
export async function fetchGitHubCalendar(username, { token, signal, fetchImpl = globalThis.fetch } = {}) {
  if (!validateUsername(username)) throw new TypeError('Enter a valid GitHub username (1–39 characters).');
  if (token !== undefined && (typeof token !== 'string' || /[\s\x00-\x1f\x7f]/.test(token))) {
    throw new TypeError('Invalid GitHub token.');
  }
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required.');
  if (signal?.aborted) throw abortError();
  const authenticated = Boolean(token);
  const url = authenticated ? 'https://api.github.com/graphql'
    : `https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(username)}?y=last`;
  let response;
  try {
    response = await fetchImpl(url, authenticated ? {
      method: 'POST', signal, redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { username } }),
    } : { method: 'GET', signal, redirect: 'error', headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw abortError();
    throw new Error('Unable to reach the contribution service. Please try again.');
  }
  if (signal?.aborted) throw abortError();
  if (!response?.ok) {
    if (response?.status === 404) throw new Error('GitHub user was not found.');
    if (response?.status === 401) throw new Error('GitHub authentication failed. Check the configured token.');
    if (response?.status === 403 || response?.status === 429) throw new Error('Contribution request was denied or rate limited. Please try again later.');
    throw new Error('The contribution service could not complete the request.');
  }
  let payload;
  try {
    payload = await response.json();
  } catch (error) {
    if (signal?.aborted || error?.name === 'AbortError') throw abortError();
    throw new Error('The contribution service returned an invalid response.');
  }
  if (signal?.aborted) throw abortError();
  if (authenticated && Array.isArray(payload?.errors) && payload.errors.length) {
    throw new Error('GitHub could not load contributions. Check the username and token permissions.');
  }
  if (authenticated && payload?.data?.user === null) throw new Error('GitHub user was not found.');
  try {
    if (authenticated) {
      const calendar = payload.data.user.contributionsCollection.contributionCalendar;
      return normalizeCalendar({ username, totalContributions: calendar.totalContributions,
        weeks: calendar.weeks.map((week) => ({ contributionDays: week.contributionDays.map((day) => ({
          ...day,
          contributionLevel: Object.hasOwn(LEVELS, day.contributionLevel) ? LEVELS[day.contributionLevel] : undefined,
        })) })) });
    }
    if (!Array.isArray(payload?.contributions)) throw new Error();
    // Sum only returned days: year totals can cover a wider interval than y=last.
    return calendarFromDays(username, payload.contributions.map((day) => ({
      date: day.date, contributionCount: day.count, contributionLevel: day.level,
    })));
  } catch {
    throw new Error('The contribution service returned an invalid calendar.');
  }
}
