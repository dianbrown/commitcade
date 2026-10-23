import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoCalendar, renderGraph, themes } from '../src/core/index.js';

const cli = fileURLToPath(new URL('../cli/index.js', import.meta.url));
const action = fileURLToPath(new URL('../action/index.js', import.meta.url));
const noNetwork = 'data:text/javascript,' + encodeURIComponent('globalThis.fetch = () => { throw new Error("Network access is forbidden in CLI tests"); };');

function run(args, cwd) {
  return spawnSync(process.execPath, ['--import', noNetwork, cli, ...args], {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, GITHUB_TOKEN: '', NODE_OPTIONS: '' },
  });
}

async function temporaryDirectory(t) {
  const directory = await mkdtemp(join(tmpdir(), 'commitcade-cli-'));
  t.after(async () => {
    assert.equal(resolve(directory).startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')), true);
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test('CLI help describes available options without fetching or writing files', async (t) => {
  const cwd = await temporaryDirectory(t);
  const result = run(['--help'], cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--username/);
  assert.match(result.stdout, /--demo/);
  assert.match(result.stdout, /GITHUB_TOKEN/);
  assert.deepEqual(await readdir(cwd), []);
});

test('CLI demo creates the default SVG offline and is deterministic', async (t) => {
  const cwd = await temporaryDirectory(t);
  const first = run(['--demo'], cwd);
  assert.equal(first.status, 0, first.stderr);
  const output = join(cwd, 'dist', 'ufo-contribution-graph.svg');
  const svg = await readFile(output, 'utf8');
  assert.match(svg, /<svg\b/);
  assert.match(svg, /<\/svg>/);
  assert.match(first.stdout, /Created/);
  const second = run(['--demo'], cwd);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(await readFile(output, 'utf8'), svg);
});

test('CLI forwards rendering options and creates nested output directories', async (t) => {
  const cwd = await temporaryDirectory(t);
  const output = join('folder with spaces', 'nested', 'graph.svg');
  const result = run(['--demo', '--output', output, '--type', 'ufo', '--theme', 'github-light', '--beam-color', '#123abc', '--speed', '2', '--no-labels', '--no-stars', '--static'], cwd);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(cwd, output), 'utf8'), renderGraph(createDemoCalendar(), {
    type: 'ufo', theme: 'github-light', beamColor: '#123abc', speed: 2,
    showLabels: false, showStars: false, animation: false,
  }));
});

test('CLI rejects invalid arguments before writing any output', async (t) => {
  const cases = [
    [[], /username/i],
    [['--username', ''], /username/i],
    [['--username', '../someone'], /username/i],
    [['--username', 'a--b'], /username/i],
    [['--demo', '--username', 'octocat'], /either/i],
    [['--demo', '--type', 'missing'], /graph type/i],
    [['--demo', '--theme', 'missing'], /theme/i],
    [['--demo', '--beam-color', 'red'], /hex color/i],
    [['--demo', '--speed', '0'], /speed/i],
    [['--demo', '--speed', '0.01'], /speed/i],
    [['--demo', '--speed', '6'], /speed/i],
    [['--demo', '--speed', '-1'], /speed|argument/i],
    [['--demo', '--speed', 'NaN'], /speed/i],
    [['--demo', '--speed', 'Infinity'], /speed/i],
    [['--demo', '--output', ''], /output/i],
    [['--demo', '--output', 'graph.png'], /SVG/i],
    [['--demo', '--unknown'], /unknown/i],
    [['--demo', 'extra'], /argument/i],
    [['--demo', '--output'], /argument/i],
    [['--demo', '--token', 'not-a-real-token'], /unknown/i],
  ];
  for (const [args, message] of cases) {
    await t.test(JSON.stringify(args), async (t) => {
      const cwd = await temporaryDirectory(t);
      const result = run(args, cwd);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, message);
      assert.deepEqual(await readdir(cwd), []);
    });
  }
});

function runAction(cwd, input = {}, preload = noNetwork) {
  return spawnSync(process.execPath, ['--import', preload, action], {
    cwd,
    encoding: 'utf8',
    timeout: 15_000,
    env: {
      ...process.env,
      NODE_OPTIONS: '', GITHUB_TOKEN: '', INPUT_GITHUB_TOKEN: '',
      INPUT_GITHUB_USER_NAME: 'octocat', INPUT_TYPES: 'ufo',
      INPUT_BEAM_COLOR: '#a3ff12', INPUT_SPEED: '1',
      INPUT_SHOW_LABELS: 'true', INPUT_SHOW_STARS: 'true',
      INPUT_OUTPUT_DIR: 'dist', GITHUB_WORKSPACE: cwd,
      GITHUB_OUTPUT: join(cwd, 'github-output'),
      ...input,
    },
  });
}

test('action generates both themes and its output with a mocked public request', async (t) => {
  const cwd = await temporaryDirectory(t);
  const preload = 'data:text/javascript,' + encodeURIComponent(`
    let requests = 0;
    globalThis.fetch = async (url, options) => {
      if (++requests > 1) throw new Error('Only one calendar request is expected');
      if (url !== 'https://github-contributions-api.jogruber.de/v4/octocat?y=last') throw new Error('Unexpected provider');
      if (options.headers.Authorization) throw new Error('Public requests must not include a token');
      return { ok: true, json: async () => ({ contributions: [
        { date: '2026-01-04', count: 3, level: 1 }
      ] }) };
    };
  `);
  // An explicitly empty action input must override an ambient workflow token.
  const result = runAction(cwd, { INPUT_OUTPUT_DIR: 'assets/graphs', INPUT_TYPES: 'ufo, ufo',
    INPUT_GITHUB_TOKEN: '', GITHUB_TOKEN: 'ambient-token-must-not-be-used' }, preload);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual((await readdir(join(cwd, 'assets', 'graphs'))).sort(), ['ufo-contribution-graph-dark.svg', 'ufo-contribution-graph.svg']);
  const light = await readFile(join(cwd, 'assets', 'graphs', 'ufo-contribution-graph.svg'), 'utf8');
  const dark = await readFile(join(cwd, 'assets', 'graphs', 'ufo-contribution-graph-dark.svg'), 'utf8');
  assert.match(light, /<svg\b/);
  assert.match(dark, /<svg\b/);
  assert.ok(light.includes(themes['github-light'].background));
  assert.ok(dark.includes(themes['github-dark'].background));
  assert.notEqual(light, dark);
  assert.equal(await readFile(join(cwd, 'github-output'), 'utf8'), 'output_dir=assets/graphs\n');
});

test('action sends its configured token only to the official GraphQL API', async (t) => {
  const cwd = await temporaryDirectory(t);
  const preload = 'data:text/javascript,' + encodeURIComponent(`
    globalThis.fetch = async (url, options) => {
      if (url !== 'https://api.github.com/graphql') throw new Error('Unexpected provider');
      if (options.headers.Authorization !== 'Bearer test-token') throw new Error('Missing configured token');
      if (JSON.parse(options.body).variables.username !== 'octocat') throw new Error('Incorrect username');
      return { ok: true, json: async () => ({ data: { user: { contributionsCollection: { contributionCalendar: {
        totalContributions: 3,
        weeks: [{ contributionDays: [{ date: '2026-01-04', contributionCount: 3, contributionLevel: 'FIRST_QUARTILE', weekday: 0 }] }]
      } } } } }) };
    };
  `);
  const result = runAction(cwd, { INPUT_GITHUB_TOKEN: 'test-token' }, preload);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(join(cwd, 'github-output'), 'utf8'), 'output_dir=dist\n');
  assert.equal((result.stdout + result.stderr).includes('test-token'), false);
});

test('action rejects invalid inputs before any request or file write', async (t) => {
  const cases = [
    [{ INPUT_OUTPUT_DIR: '../outside' }, /subdirectory/],
    [{ INPUT_OUTPUT_DIR: '.' }, /subdirectory/],
    [{ INPUT_OUTPUT_DIR: 'graphs\ninjected=value' }, /control characters/],
    [{ INPUT_SHOW_LABELS: 'yes' }, /true.*false/],
    [{ INPUT_TYPES: 'missing' }, /graph type/],
    [{ INPUT_SPEED: '6' }, /speed/i],
  ];
  for (const [inputs, message] of cases) {
    await t.test(JSON.stringify(inputs), async (t) => {
      const cwd = await temporaryDirectory(t);
      const result = runAction(cwd, inputs);
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stderr, message);
      assert.deepEqual(await readdir(cwd), []);
    });
  }
});
