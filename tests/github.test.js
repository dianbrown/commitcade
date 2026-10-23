import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchGitHubCalendar, validateUsername, renderGraph } from '../src/core/index.js';

const publicPayload = { total: { 2023: 4000, 2024: 2000, lastYear: 6 }, contributions: [
  { date: '2024-01-08', count: 4, level: 2 }, { date: '2024-01-06', count: 2, level: 1 },
] };
const ok = (payload) => ({ ok: true, status: 200, json: async () => payload });
const graphql = (calendar) => ({ data: { user: { contributionsCollection: { contributionCalendar: calendar } } } });
const official = { totalContributions: 14, weeks: [{ contributionDays: [
  { date: '2024-01-01', contributionCount: 0, contributionLevel: 'NONE', weekday: 1 },
  { date: '2024-01-02', contributionCount: 1, contributionLevel: 'FIRST_QUARTILE', weekday: 2 },
  { date: '2024-01-03', contributionCount: 2, contributionLevel: 'SECOND_QUARTILE', weekday: 3 },
  { date: '2024-01-04', contributionCount: 4, contributionLevel: 'THIRD_QUARTILE', weekday: 4 },
  { date: '2024-01-05', contributionCount: 7, contributionLevel: 'FOURTH_QUARTILE', weekday: 5 },
] }] };

test('username validation accepts GitHub handles and rejects paths, whitespace, and invalid hyphens', async () => {
  for (const username of ['octocat', 'A', 'a-b', '123', 'a'.repeat(39)]) assert.equal(validateUsername(username), true);
  for (const username of ['', '-a', 'a-', 'a--b', 'a_b', 'a/b', 'a?y=all', '<script>', ' a', 'é', 'a'.repeat(40), null]) {
    assert.equal(validateUsername(username), false);
    await assert.rejects(fetchGitHubCalendar(username, { fetchImpl: () => assert.fail('must validate before fetching') }), /username/);
  }
});

test('public endpoint normalizes sparse days with UTC weeks and sums the requested interval only', async () => {
  const controller = new AbortController();
  let request;
  const calendar = await fetchGitHubCalendar('Octocat', { signal: controller.signal, fetchImpl: async (...args) => {
    request = args;
    return ok(publicPayload);
  } });
  assert.equal(request[0], 'https://github-contributions-api.jogruber.de/v4/Octocat?y=last');
  assert.equal(request[1].method, 'GET');
  assert.equal(request[1].signal, controller.signal);
  assert.equal(request[1].headers.Authorization, undefined);
  assert.equal(calendar.username, 'Octocat');
  assert.equal(calendar.totalContributions, 6);
  assert.equal(calendar.weeks.length, 2);
  assert.deepEqual(calendar.weeks[1].contributionDays[0], { date: '2024-01-07', contributionCount: 0, contributionLevel: 0, weekday: 0 });
  assert.match(renderGraph(calendar), /6 contributions/);
});

test('token requests go only to official GraphQL with variables and map all five levels', async () => {
  let request;
  const calendar = await fetchGitHubCalendar('octocat', { token: 'private-test-token', fetchImpl: async (...args) => {
    request = args;
    return ok(graphql(official));
  } });
  assert.equal(request[0], 'https://api.github.com/graphql');
  assert.equal(request[1].method, 'POST');
  assert.equal(request[1].redirect, 'error');
  assert.equal(request[1].headers.Authorization, 'Bearer private-test-token');
  assert.deepEqual(JSON.parse(request[1].body).variables, { username: 'octocat' });
  assert.match(JSON.parse(request[1].body).query, /contributionCalendar/);
  assert.doesNotMatch(request[0] + request[1].body + JSON.stringify(calendar), /private-test-token/);
  assert.deepEqual(calendar.weeks[0].contributionDays.map((entry) => entry.contributionLevel), [0, 1, 2, 3, 4]);
  assert.equal(calendar.totalContributions, 14);
});

test('empty public and GraphQL calendars are valid', async () => {
  for (const [payload, token] of [[{ contributions: [], total: {} }, undefined], [graphql({ totalContributions: 0, weeks: [] }), 'token']]) {
    assert.deepEqual(await fetchGitHubCalendar('octocat', { token, fetchImpl: async () => ok(payload) }), { username: 'octocat', totalContributions: 0, weeks: [] });
  }
});

test('HTTP failures are useful and never echo response details', async () => {
  for (const [status, message] of [[404, /not found/], [401, /authentication/], [403, /rate limited/], [429, /rate limited/], [500, /could not complete/]]) {
    await assert.rejects(fetchGitHubCalendar('octocat', { token: 'SECRET', fetchImpl: async () => ({ ok: false, status,
      statusText: 'SECRET', json: async () => assert.fail('must not parse error body'),
    }) }), (error) => message.test(error.message) && !String(error.stack).includes('SECRET'));
  }
});

test('network, JSON and GraphQL errors do not expose credentials, bodies or causes', async () => {
  const secret = 'test-secret-never-echo';
  for (const fetchImpl of [async () => { throw new Error(secret); }, async () => ({ ok: true, json: async () => { throw new Error(secret); } }),
    async () => ok({ errors: [{ message: secret }] }), async () => ok({ data: { user: null } })]) {
    await assert.rejects(fetchGitHubCalendar('octocat', { token: secret, fetchImpl }), (error) => {
      assert.doesNotMatch(error.stack, new RegExp(secret));
      assert.equal(error.cause, undefined);
      return true;
    });
  }
});

test('malformed calendars fail with sanitized errors', async () => {
  for (const payload of [null, {}, { contributions: null }, { contributions: [{ date: '2024-02-30', count: 2, level: 1 }] },
    { contributions: [{ date: '2024-01-01', count: -1, level: 1 }] },
    { contributions: [{ date: '2024-01-01', count: 1, level: 'SECRET' }] }]) {
    await assert.rejects(fetchGitHubCalendar('octocat', { fetchImpl: async () => ok(payload) }), /invalid calendar/);
  }
  const bad = structuredClone(official);
  bad.weeks[0].contributionDays[0].contributionLevel = '__proto__';
  await assert.rejects(fetchGitHubCalendar('octocat', { token: 'token', fetchImpl: async () => ok(graphql(bad)) }), /invalid calendar/);
});

test('abort before request, during request, and while decoding keeps AbortError without leaking reason', async () => {
  const pre = new AbortController();
  pre.abort('secret-reason');
  await assert.rejects(fetchGitHubCalendar('octocat', { signal: pre.signal, fetchImpl: () => assert.fail('already aborted') }), { name: 'AbortError' });
  for (const duringJson of [false, true]) {
    const controller = new AbortController();
    await assert.rejects(fetchGitHubCalendar('octocat', { signal: controller.signal, fetchImpl: async () => {
      if (!duringJson) { controller.abort('secret-reason'); throw new Error('secret-reason'); }
      return { ok: true, json: async () => { controller.abort('secret-reason'); return publicPayload; } };
    } }), (error) => error.name === 'AbortError' && !error.message.includes('secret-reason'));
  }
  await assert.rejects(fetchGitHubCalendar('octocat', { fetchImpl: async () => { throw Object.assign(new Error('secret'), { name: 'AbortError' }); } }), { name: 'AbortError' });
});

test('invalid tokens and fetch implementations are rejected without network requests', async () => {
  for (const token of ['token\nsecret', ' token', {}, null]) {
    await assert.rejects(fetchGitHubCalendar('octocat', { token, fetchImpl: () => assert.fail('invalid token') }), /Invalid GitHub token/);
  }
  await assert.rejects(fetchGitHubCalendar('octocat', { fetchImpl: null }), /fetch implementation/);
});
