import { renderUfo } from './types/ufo.js';

export const typeRegistry = Object.freeze({
  ufo: Object.freeze({
    id: 'ufo', name: 'UFO',
    description: 'A metallic flying saucer harvests your contributions with a glowing tractor beam.',
    render: renderUfo,
  }),
});

export const graphTypes = Object.freeze(Object.values(typeRegistry).map(({ id, name, description }) => Object.freeze({ id, name, description })));
