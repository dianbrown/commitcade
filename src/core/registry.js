import { renderUfo } from './types/ufo.js';
import { renderGhostHaunting } from './types/ghost-haunting.js';
import { renderMimic } from './types/mimic.js';
import { renderAntHeist } from './types/ant-heist.js';
import { renderOvergrown } from './types/overgrown.js';

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
  mimic: Object.freeze({
    id: 'mimic', name: 'The Mimic',
    description: 'Disguised contribution squares wake up, swallow nearby tiles, then sneeze them back into place.',
    render: renderMimic,
  }),
  'ant-heist': Object.freeze({
    id: 'ant-heist', name: 'Ant Heist',
    description: 'Tiny ant teams lift contribution squares and carry them into burrows.',
    render: renderAntHeist,
  }),
  overgrown: Object.freeze({
    id: 'overgrown', name: 'Overgrown',
    description: 'Vines connect active squares and turn contributions into a flowering garden.',
    render: renderOvergrown,
  }),
});

export const graphTypes = Object.freeze(Object.values(typeRegistry).map(({ id, name, description }) => Object.freeze({ id, name, description })));
