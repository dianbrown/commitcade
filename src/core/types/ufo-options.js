export const flightModes = Object.freeze(['classic', 'curious', 'collector']);

export function resolveUfoOptions({ flightMode = 'classic', beamSize = 1 } = {}) {
  if (!flightModes.includes(flightMode)) {
    throw new TypeError(`Flight mode must be one of: ${flightModes.join(', ')}.`);
  }
  if (!Number.isFinite(beamSize) || beamSize < 0.5 || beamSize > 3) {
    throw new RangeError('Beam size must be a number between 0.5 and 3.');
  }
  return { flightMode, beamSize };
}
