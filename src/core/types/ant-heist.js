import { createAntHeistScene } from './ant-heist-scene.js';
import { compactSvg, compactTimeline, number as n } from './compact-calendar.js';

export function renderAntHeist(calendar, options, theme) {
  const scene = createAntHeistScene(calendar);
  const { id, css, animate } = compactTimeline('ant-heist', calendar, options, scene.duration);
  const classes = new Map();
  const actors = [];
  const holes = [];
  const antColor = options.theme === 'github-light' ? '#572d1c' : '#dc9a61';
  for (const [i, job] of scene.jobs.entries()) {
    const { cell, burrow, delay } = job;
    const name = `cargo-${i}`;
    classes.set(cell.date, name);
    const normal = 'transform:translate(0,0) rotate(0deg) scale(1);opacity:1';
    const tucked = `transform:translate(${n(burrow.x - cell.x)}px,${n(burrow.y - cell.y)}px) rotate(0deg) scale(.05);opacity:0`;
    animate(name, [[0, normal], [job.arrive, normal], [3.4, 'transform:translate(-1px,0) rotate(-5deg) scale(1);opacity:1'],
      [3.8, 'transform:translate(1px,-1px) rotate(5deg) scale(1);opacity:1'],
      [job.lift, 'transform:translate(0,-3px) rotate(0deg) scale(1);opacity:1'],
      ...job.frames.map((f) => [f.time, `transform:translate(${n(f.x - cell.x)}px,${n(f.y - cell.y)}px) rotate(${n(f.tilt)}deg) scale(1);opacity:1`]),
      [job.hidden, tucked], [job.restore, tucked], [job.restore + .01, 'transform:translate(0,0) rotate(0deg) scale(.75);opacity:0'],
      [19, normal], [20, normal]], delay);
    animate(`team-${i}`, [[0, `transform:translate(${burrow.x}px,${burrow.y}px);opacity:0`],
      [.5, `transform:translate(${burrow.x}px,${burrow.y - 8}px);opacity:1`],
      [job.arrive, `transform:translate(${cell.x}px,${cell.y}px);opacity:1`],
      [job.lift, `transform:translate(${cell.x}px,${cell.y - 3}px);opacity:1`],
      ...job.frames.map((f) => [f.time, `transform:translate(${n(f.x)}px,${n(f.y)}px);opacity:1`]),
      [job.hidden, `transform:translate(${burrow.x}px,${burrow.y}px);opacity:0`],
      [20, `transform:translate(${burrow.x}px,${burrow.y}px);opacity:0`]], delay);
    animate(`hole-${i}`, [[0, 'opacity:1'], [20, 'opacity:1']], delay);
    holes.push(`<g class="effect hole-${i}" transform="translate(${burrow.x} ${burrow.y})"><ellipse rx="9" ry="3.5" fill="${antColor}" opacity=".55"/><ellipse rx="6" ry="2.4" fill="${theme.background}"/><path d="M-8 1L-10 2M7 1L9 2" stroke="${antColor}" stroke-width=".8"/></g>`);
    const offsets = job.workers === 3 ? [-7, 0, 7] : [0];
    actors.push(`<g class="effect team-${i}" data-target="${cell.date}" data-workers="${job.workers}">${offsets.map((x, j) => `<g transform="translate(${x} ${j === 1 ? 10 : 8}) rotate(${i % 2 ? 12 : -12})">
      <g class="legs" fill="none" stroke="${antColor}" stroke-width=".75" stroke-linecap="round"><path d="M-1-2L-4-4-5-2M-1 0L-5 0M-1 2L-4 4-5 3M1-2L4-4 5-2M1 0L5 0M1 2L4 4 5 3"/></g>
      <ellipse cy="2.6" rx="1.9" ry="2.5" fill="${antColor}"/><ellipse cy="-.6" rx="1.2" ry="1.5" fill="${antColor}"/><circle cy="-3" r="1.55" fill="${antColor}"/>
      <path d="M-1-4L-2-6M1-4L2-6" fill="none" stroke="${antColor}" stroke-width=".7"/>
    </g>`).join('')}</g>`);
  }
  if (options.animation) css.push(`#${id} .legs{animation:${id}-scurry ${n(.18 / options.speed)}s ease-in-out infinite alternate}
    @keyframes ${id}-scurry{from{transform:skewY(-14deg)}to{transform:skewY(14deg)}}`);
  return compactSvg(calendar, options, theme, { id, title: 'Ant Heist',
    description: 'Tiny ants lift active contribution squares and carry them into burrows. Busy days need a team of three. Stolen tiles reappear before the next heist.',
    layout: scene, css, classes, movingDates: new Set(classes.keys()), underlay: holes.join(''), actors: actors.join('') });
}
