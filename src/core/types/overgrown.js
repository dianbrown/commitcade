import { createOvergrownScene } from './overgrown-scene.js';
import { compactSvg, compactTimeline, number as n } from './compact-calendar.js';

export function renderOvergrown(calendar, options, theme) {
  const scene = createOvergrownScene(calendar);
  const { id, css, animate } = compactTimeline('overgrown', calendar, options, scene.duration);
  const classes = new Map();
  const vines = [];
  const plants = [];
  const stem = options.theme === 'github-light' ? '#386b36' : '#79b968';
  const leaf = options.theme === 'github-light' ? '#559241' : '#a1c96c';
  for (const [i, garden] of scene.gardens.entries()) for (const [j, plant] of garden.plants.entries()) {
    const key = `${i}-${j}`;
    const { sprout, bloom } = plant;
    const { delay, shed, retreat, restored } = garden;
    const flower = ['#f4e8bc', '#f1c46d', '#e5a0a2', '#f5eede'][plant.contributionLevel - 1];
    const hasFlower = plant.contributionLevel >= 2;
    classes.set(plant.date, `soil-${key}`);
    animate(`soil-${key}`, [[0, 'opacity:1;transform:scale(1)'], [sprout, 'opacity:1;transform:scale(1)'],
      [bloom, 'opacity:.2;transform:scale(.65)'], [retreat, 'opacity:.2;transform:scale(.65)'],
      [restored, 'opacity:1;transform:scale(1)'], [28, 'opacity:1;transform:scale(1)']], delay);
    animate(`plant-${key}`, [[0, 'opacity:0;transform:scale(0)'], [sprout, 'opacity:0;transform:scale(0)'],
      [bloom, 'opacity:1;transform:scale(1)'], [retreat, 'opacity:1;transform:scale(1)'],
      [restored, 'opacity:0;transform:scale(0)'], [28, 'opacity:0;transform:scale(0)']], delay);
    animate(`bloom-${key}`, [[0, 'opacity:0;transform:scale(.1)'], [bloom - .3, 'opacity:0;transform:scale(.1)'],
      [bloom + 1, 'opacity:1;transform:scale(1)'], [shed, 'opacity:1;transform:scale(1)'],
      [shed + 1, 'opacity:0;transform:scale(.6)'], [28, 'opacity:0;transform:scale(.6)']], delay);
    if (plant.from) {
      animate(`vine-${key}`, [[0, 'opacity:0;stroke-dashoffset:1'], [sprout - 1, 'opacity:0;stroke-dashoffset:1'],
        [sprout + .3, 'opacity:1;stroke-dashoffset:0'], [retreat, 'opacity:1;stroke-dashoffset:0'],
        [restored, 'opacity:0;stroke-dashoffset:1'], [28, 'opacity:0;stroke-dashoffset:1']], delay);
      vines.push(`<path class="effect vine-${key}" d="M${plant.from.x} ${plant.from.y + 5}Q${n((plant.x + plant.from.x) / 2 + 6)} ${n((plant.y + plant.from.y) / 2 + 10)} ${plant.x} ${plant.y + 5}" pathLength="1" stroke-dasharray="1" fill="none" stroke="${stem}" stroke-width="1.3" stroke-linecap="round"/>`);
    }
    const petalMarkup = hasFlower ? Array.from({ length: 3 }, (_, k) => {
      animate(`petal-${key}-${k}`, [[0, 'opacity:0;transform:translate(0,0) rotate(0deg)'],
        [shed + k * .15, 'opacity:0;transform:translate(0,0) rotate(0deg)'],
        [shed + .2 + k * .15, 'opacity:1;transform:translate(1px,0) rotate(15deg)'],
        [shed + 3, `opacity:0;transform:translate(${8 + k * 4}px,${11 + k * 2}px) rotate(${100 + k * 35}deg)`],
        [28, 'opacity:0;transform:translate(0,0) rotate(0deg)']], delay);
      return `<ellipse class="effect petal-${key}-${k}" cx="0" cy="-8" rx="1.5" ry="2.5" fill="${flower}"/>`;
    }).join('') : '';
    plants.push(`<g transform="translate(${plant.x} ${plant.y})" data-plant="${plant.date}"><g class="effect plant-${key}"><g class="sway">
      <path d="M0 5Q-2 0 0-8" fill="none" stroke="${stem}" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M-1 2Q-8 2-6-4Q-1-4-1 2ZM0-1Q6-7 7-2Q5 2 0-1Z" fill="${leaf}"/>
      <path d="M-1 2L-5-2M0-1L5-3" stroke="${stem}" stroke-width=".6" fill="none"/>
      ${hasFlower ? `<g transform="translate(0 -8)"><g class="effect bloom-${key}">${[0, 72, 144, 216, 288].map((angle) => `<ellipse cy="-2.8" rx="1.8" ry="2.6" transform="rotate(${angle})" fill="${flower}"/>`).join('')}<circle r="1.7" fill="#a87b37"/><circle cx="-.4" cy="-.5" r=".7" fill="#f6d681"/></g></g>` : `<path d="M0-6Q-5-7-3-11Q1-10 0-6" fill="${leaf}"/>`}
    </g></g>${petalMarkup}</g>`);
  }
  if (options.animation) css.push(`#${id} .sway{animation:${id}-breeze ${n(4.8 / options.speed)}s ease-in-out infinite alternate;transform-origin:0 5px}
    @keyframes ${id}-breeze{from{transform:rotate(-5deg)}to{transform:rotate(6deg)}}`);
  return compactSvg(calendar, options, theme, { id, title: 'Overgrown',
    description: 'Vines spread between active contribution squares. Tiles sprout leaves and flowers, shed petals, then return to their original colors as the garden retreats.',
    layout: scene, css, classes, foreground: `<g class="vines">${vines.join('')}</g><g class="plants">${plants.join('')}</g>` });
}
