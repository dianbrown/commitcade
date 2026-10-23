import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fetchGitHubCalendar, renderGraph } from '../src/core/index.js';
import { parseBoolean, safeErrorMessage, validateOptions, validateUsername } from '../cli/options.js';

const token = process.env.INPUT_GITHUB_TOKEN ?? process.env.GITHUB_TOKEN;

async function main() {
  const username = validateUsername(process.env.INPUT_GITHUB_USER_NAME);
  const types = [...new Set((process.env.INPUT_TYPES ?? 'ufo').split(',').map((type) => type.trim()))];
  const variants = types.flatMap((type) => ['github-light', 'github-dark'].map((theme) => validateOptions({
    type,
    theme,
    beamColor: process.env.INPUT_BEAM_COLOR || '#a3ff12',
    speed: process.env.INPUT_SPEED || '1',
    showLabels: parseBoolean(process.env.INPUT_SHOW_LABELS, 'show_labels'),
    showStars: parseBoolean(process.env.INPUT_SHOW_STARS, 'show_stars'),
  })));
  const workspace = resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const requestedOutput = process.env.INPUT_OUTPUT_DIR ?? 'dist';
  if (!requestedOutput.trim() || /[\r\n\0]/.test(requestedOutput)) throw new Error('output_dir must be a non-empty path without control characters.');
  const outputPath = resolve(workspace, requestedOutput);
  const outputDir = relative(workspace, outputPath);
  if (!outputDir || outputDir === '..' || outputDir.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || isAbsolute(outputDir)) {
    throw new Error('output_dir must be a subdirectory of GITHUB_WORKSPACE.');
  }
  const calendar = await fetchGitHubCalendar(username, { token, signal: AbortSignal.timeout(30_000) });
  const files = variants.map((options) => ({
    name: `${options.type}-contribution-graph${options.theme === 'github-dark' ? '-dark' : ''}.svg`,
    svg: renderGraph(calendar, options),
  }));
  await mkdir(outputPath, { recursive: true });
  for (const { name, svg } of files) {
    await writeFile(join(outputPath, name), svg, 'utf8');
    process.stdout.write(`Created ${join(outputDir, name)}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `output_dir=${outputDir.replaceAll('\\', '/')}\n`, 'utf8');
  }
}

main().catch((error) => {
  process.stderr.write(`commitcade action: ${safeErrorMessage(error, token)}\n`);
  process.exitCode = 1;
});
