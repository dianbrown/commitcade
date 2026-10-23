import { graphTypes, themes } from '../src/core/index.js';

export function validateOptions(values = {}) {
  const type = values.type ?? 'ufo';
  const theme = values.theme ?? 'github-dark';
  const beamColor = values.beamColor ?? '#a3ff12';
  const speed = Number(values.speed ?? 1);
  if (!graphTypes.some((entry) => entry.id === type)) {
    throw new Error(`Unknown graph type "${type}". Choose: ${graphTypes.map((entry) => entry.id).join(', ')}.`);
  }
  if (!Object.hasOwn(themes, theme)) {
    throw new Error(`Unknown theme "${theme}". Choose: ${Object.keys(themes).join(', ')}.`);
  }
  if (!/^#[0-9a-f]{6}$/i.test(beamColor)) {
    throw new Error('Beam color must be a six-digit hex color, such as #a3ff12.');
  }
  if (!Number.isFinite(speed) || speed < 0.1 || speed > 5) {
    throw new Error('Speed must be a finite number between 0.1 and 5.');
  }
  return {
    type, theme, beamColor, speed,
    showLabels: values.showLabels ?? true,
    showStars: values.showStars ?? true,
    animation: values.animation ?? true,
  };
}

export function validateUsername(username) {
  if (typeof username !== 'string' || !/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(username) || username.includes('--')) {
    throw new Error('Provide a valid GitHub username (1–39 letters, numbers, or single hyphens).');
  }
  return username;
}

export function parseBoolean(value, name, fallback = true) {
  if (value === undefined || value === '') return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be "true" or "false".`);
}

export function safeErrorMessage(error, token) {
  const message = error instanceof Error ? error.message : String(error);
  return token ? message.split(token).join('[redacted]') : message;
}
