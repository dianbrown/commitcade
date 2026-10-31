import { renderUfo } from './types/ufo.js';
import { renderGhostHaunting } from './types/ghost-haunting.js';

export const typeRegistry = Object.freeze({
  ufo: Object.freeze({
    id: 'ufo', name: 'UFO',
    description: 'A metallic flying saucer harvests your contributions with a glowing tractor beam.',
    render: renderUfo,
  }),
  'ghost-haunting': Object.freeze({
    id: 'ghost-haunting', name: 'Ghost Haunting',
    description: 'Tiny white ghosts emerge from contribution squares and possess nearby active tiles.',
    render: renderGhostHaunting,
  }),
});

export const graphTypes = Object.freeze(Object.values(typeRegistry).map(({ id, name, description }) => Object.freeze({ id, name, description })));
