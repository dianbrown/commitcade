#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { createDemoCalendar, fetchGitHubCalendar, renderGraph, graphTypes, themes } from '../src/core/index.js';
import { safeErrorMessage, validateOptions, validateUsername } from './options.js';

const help = `Commitcade — animated GitHub contribution graphs

Usage:
  commitcade --username YOUR_USERNAME [options]
  commitcade --demo [options]

Options:
  --username NAME    GitHub username; mutually exclusive with --demo
  --demo             Render deterministic sample data without network access
  --type TYPE        Graph type: ${graphTypes.map(({ id }) => id).join(', ')} (default: ufo)
  --theme THEME      ${Object.keys(themes).join(', ')} (default: github-dark)
  --beam-color HEX   Six-digit hex color (default: #a3ff12)
  --speed NUMBER     Animation speed multiplier, 0.1–5 (default: 1)
  --output PATH      SVG file (default: dist/ufo-contribution-graph.svg)
  --no-labels        Hide calendar labels
  --no-stars         Hide background stars
  --static           Disable animation
  --help, -h         Show this help

Set GITHUB_TOKEN in your environment to use GitHub's official GraphQL API.
Without a token, public data comes from a third-party contribution API.
No token is needed for --demo. SVG is the supported output format.
`;

async function main() {
  const { values } = parseArgs({
    strict: true,
    allowPositionals: false,
    options: {
      username: { type: 'string' },
      demo: { type: 'boolean', default: false },
      type: { type: 'string' },
      theme: { type: 'string' },
      'beam-color': { type: 'string' },
      speed: { type: 'string' },
      output: { type: 'string', default: 'dist/ufo-contribution-graph.svg' },
      'no-labels': { type: 'boolean', default: false },
      'no-stars': { type: 'boolean', default: false },
      static: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });
  if (values.help) {
    process.stdout.write(help);
    return;
  }
  if (values.demo && values.username !== undefined) throw new Error('Use either --username or --demo, not both.');
  if (!values.demo) validateUsername(values.username);
  if (!values.output.trim()) throw new Error('--output must be a non-empty file path.');
  if (!/\.svg$/i.test(values.output)) throw new Error('--output must end in .svg; SVG is the supported output format.');
  const options = validateOptions({
    type: values.type,
    theme: values.theme,
    beamColor: values['beam-color'],
    speed: values.speed,
    showLabels: !values['no-labels'],
    showStars: !values['no-stars'],
    animation: !values.static,
  });
  const calendar = values.demo
    ? createDemoCalendar()
    : await fetchGitHubCalendar(values.username, { token: process.env.GITHUB_TOKEN, signal: AbortSignal.timeout(30_000) });
  const svg = renderGraph(calendar, options);
  const output = resolve(values.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, svg, 'utf8');
  process.stdout.write(`Created ${output}\n`);
}

main().catch((error) => {
  process.stderr.write(`commitcade: ${safeErrorMessage(error, process.env.GITHUB_TOKEN)}\nRun commitcade --help for usage.\n`);
  process.exitCode = 1;
});
