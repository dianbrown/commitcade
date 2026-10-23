import { normalizeCalendar } from './calendar.js';
import { themes } from './themes.js';
import { typeRegistry } from './registry.js';

export { createDemoCalendar } from './calendar.js';
export { fetchGitHubCalendar, validateUsername } from './github.js';
export { graphTypes } from './registry.js';
export { themes } from './themes.js';

const defaults = Object.freeze({ type: 'ufo', theme: 'github-dark', beamColor: '#a3ff12', speed: 1,
  showLabels: true, showStars: true, animation: true });

/** Render a dependency-free, responsive SVG. Options never interpolate arbitrary CSS. */
export function renderGraph(calendar, options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Options must be an object.');
  const settings = { ...defaults };
  for (const key of Object.keys(defaults)) if (options[key] !== undefined) settings[key] = options[key];
  if (typeof settings.type !== 'string' || !Object.hasOwn(typeRegistry, settings.type)) throw new TypeError('Unknown graph type.');
  if (typeof settings.theme !== 'string' || !Object.hasOwn(themes, settings.theme)) throw new TypeError('Unknown graph theme.');
  if (typeof settings.beamColor !== 'string' || !/^#[\da-f]{6}$/i.test(settings.beamColor)) {
    throw new TypeError('Beam color must be a six-digit hex color.');
  }
  if (!Number.isFinite(settings.speed) || settings.speed < 0.1 || settings.speed > 5) {
    throw new RangeError('Animation speed must be between 0.1 and 5.');
  }
  for (const key of ['showLabels', 'showStars', 'animation']) {
    if (typeof settings[key] !== 'boolean') throw new TypeError(`${key} must be a boolean.`);
  }
  return typeRegistry[settings.type].render(normalizeCalendar(calendar), settings, themes[settings.theme]);
}
