import { escapeXml, svgId } from '../svg.js';
import { createUfoScene } from './ufo-scene.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const number = (value) => Number(value.toFixed(5));

/** Compile continuous curved flights and geometric beam captures into standalone SVG/CSS. */
export function renderUfo(calendar, options, theme) {
  const scene = createUfoScene(calendar);
  const { columns, left, pitch, size, duration, visits } = scene;
  const id = svgId(JSON.stringify([calendar, options]));
  const scope = `#${id}`;
  const seconds = `${number(duration / options.speed)}s`;
  const percent = (time) => `${number(time / duration * 100)}%`;
  const captures = visits.flatMap((visit, visitIndex) => visit.captures.map((cell, cellIndex) => ({
    ...cell, visit, index: `${visitIndex}-${cellIndex}`,
  })));
  const captureByDate = new Map(captures.map((cell) => [cell.date, cell]));
  const transform = ({ x, y, tilt = 0 }) => `translate(${number(x)}px,${number(y)}px) rotate(${number(tilt)}deg)`;
  const animations = [];
  const beams = [];
  const cells = [];
  const months = [];
  let previousMonth = '';
  let previousMonthColumn = -4;

  for (let column = 0; column < columns; column++) {
    const x = number(left + column * pitch);
    const days = calendar.weeks[column]?.contributionDays ?? [];
    const byWeekday = new Map(days.map((day) => [day.weekday, day]));
    for (const day of days) {
      const month = day.date.slice(0, 7);
      if (month !== previousMonth) {
        if (column - previousMonthColumn >= 3) {
          months.push(`<text x="${x}" y="99">${MONTHS[Number(day.date.slice(5, 7)) - 1]}</text>`);
          previousMonthColumn = column;
        }
        previousMonth = month;
      }
    }
    for (let row = 0; row < 7; row++) {
      const day = byWeekday.get(row);
      const y = 110 + row * pitch;
      const title = day ? `${day.date}: ${day.contributionCount} contribution${day.contributionCount === 1 ? '' : 's'}` : 'No contribution data';
      const metadata = day ? ` data-date="${day.date}" data-count="${day.contributionCount}"` : '';
      cells.push(`<rect class="empty-cell" x="${x}" y="${y}" width="${size}" height="${size}" rx="3" fill="${theme.empty}"${metadata}><title>${title}</title></rect>`);
      if (day?.contributionCount > 0) {
        const capture = captureByDate.get(day.date);
        const targetClass = capture && options.animation ? ` harvest-${capture.index}` : '';
        cells.push(`<g transform="translate(${number(x + size / 2)} ${y + size / 2})"><g class="contribution${targetClass}"><rect x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}" rx="3" fill="${theme.levels[day.contributionLevel - 1]}"><title>${title}</title></rect></g></g>`);
      }
    }
  }

  if (options.animation) for (const capture of captures) {
    const { index, liftStart, liftEnd, visit } = capture;
    const rise = number(visit.shipY + 6 - capture.y);
    const drift = number(visit.shipX - capture.x);
    animations.push(`${scope} .harvest-${index}{animation:${id}-collect-${index} ${seconds} linear infinite}
      @keyframes ${id}-collect-${index}{
        0%,${percent(visit.beamFull)}{transform:translate(0,0) scale(1);opacity:1;filter:drop-shadow(0 0 0 transparent)}
        ${percent(liftStart)}{transform:translate(0,-1px) scale(1.08);opacity:1;filter:drop-shadow(0 0 4px ${options.beamColor})}
        ${percent(liftStart + 0.28)}{transform:translate(${number(drift * 0.2)}px,${number(rise * 0.2)}px) scale(.86);opacity:1;filter:drop-shadow(0 0 3px ${options.beamColor})}
        ${percent(liftEnd)}{transform:translate(${drift}px,${rise}px) scale(.06);opacity:0;filter:drop-shadow(0 0 1px ${options.beamColor})}
        ${percent(scene.resetStart)}{transform:translate(${drift}px,${rise}px) scale(.06);opacity:0;filter:none}
        ${percent(scene.resetStart + 0.01)}{transform:translate(0,0) scale(1);opacity:0;filter:none}
        ${percent(scene.resetEnd)},100%{transform:translate(0,0) scale(1);opacity:1;filter:none}
      }`);
  }

  if (options.animation) for (const [index, visit] of visits.entries()) {
    const { beamOpen, beamFull, liftStart, liftEnd, beamClose, beamOff } = visit;
    const height = number(visit.beam.bottom - visit.shipY);
    const shape = `M -3 6 L -27 ${height} L 27 ${height} L 3 6 Z`;
    animations.push(`${scope} .beam-${index}{animation:${id}-beam-${index} ${seconds} linear infinite}
      ${scope} .spark-${index}{animation:${id}-spark-${index} ${seconds} linear infinite}
      @keyframes ${id}-beam-${index}{
        0%,${percent(beamOpen)}{transform:scale(.2,0);opacity:0}
        ${percent(beamFull)},${percent(beamClose)}{transform:scale(1);opacity:1}
        ${percent(beamOff)},100%{transform:scale(.2,0);opacity:0}
      }
      @keyframes ${id}-spark-${index}{
        0%,${percent(beamFull)}{transform:translateY(0);opacity:0}
        ${percent(liftStart)}{transform:translateY(-3px);opacity:.7}
        ${percent(liftEnd)},100%{transform:translateY(${number(-height * 0.6)}px);opacity:0}
      }`);
    beams.push(`<g transform="translate(${number(visit.shipX)} ${number(visit.shipY)})"><g class="beam-window beam-${index}" data-target="${visit.date}">
      <path d="${shape}" fill="${options.beamColor}" opacity=".28" filter="url(#${id}-soft)"/>
      <path d="${shape}" fill="url(#${id}-beam)" stroke="${options.beamColor}" stroke-width=".35" stroke-opacity=".3"/>
      <path d="M -1.5 6 L -12 ${height} L 12 ${height} L 1.5 6 Z" fill="${options.beamColor}" opacity=".09"/>
      <ellipse cx="0" cy="${height}" rx="27" ry="3.5" fill="url(#${id}-halo)"/>
      <g class="beam-particles spark-${index}" fill="${options.beamColor}"><circle cx="-8" cy="${number(height * 0.8)}" r=".8"/><circle cx="7" cy="${number(height * 0.65)}" r=".65"/><circle cx="1" cy="${number(height * 0.94)}" r="1"/></g>
    </g></g>`);
  }

  const animationCss = options.animation ? `
    ${scope} .flight{animation:${id}-flight ${seconds} linear infinite}
    ${scope} .hull{animation:${id}-hover ${number(3.8 / options.speed)}s ease-in-out infinite}
    @keyframes ${id}-flight{${scene.flight.map((frame) => `${percent(frame.time)}{transform:${transform(frame)}}`).join('')}}
    @keyframes ${id}-hover{
      0%,100%{transform:translateY(0) rotate(-2deg) scaleY(.98)}
      25%{transform:translateY(-.7px) rotate(0deg) scaleY(1)}
      50%{transform:translateY(-1.2px) rotate(2deg) scaleY(.96)}
      75%{transform:translateY(-.5px) rotate(0deg) scaleY(1)}
    }
    ${animations.join('\n')}
    @media(prefers-reduced-motion:reduce){
      ${scope} .flight{animation:none!important;transform:${transform(scene.parked)}!important}
      ${scope} .hull,${scope} .contribution{animation:none!important;transform:none!important;opacity:1!important;filter:none!important}
      ${scope} .beam-window{display:none!important;animation:none!important}
      ${scope} .beam-particles{animation:none!important}
    }` : '';
  const stars = options.showStars ? `<g class="stars" fill="${theme.text}" opacity=".4">${Array.from({ length: 34 }, (_, index) => {
    const x = 34 + ((index * 137 + 61) % 1050);
    const y = 30 + ((index * 31 + 7) % 48);
    return `<circle cx="${x}" cy="${y}" r="${index % 5 === 0 ? 1.1 : 0.6}"/>`;
  }).join('')}</g>` : '';
  const username = escapeXml(calendar.username || 'GitHub');
  const labels = options.showLabels ? `<g class="labels" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10">
    ${months.join('')}
    <text x="${number(left - 30)}" y="138">Mon</text><text x="${number(left - 30)}" y="174">Wed</text><text x="${number(left - 30)}" y="210">Fri</text>
    <text x="${number(left)}" y="242">${calendar.totalContributions.toLocaleString('en-US')} contributions · @${username}</text>
    <text x="${1120 - left - 133}" y="242">Less</text>
    ${[theme.empty, ...theme.levels].map((color, index) => `<rect x="${1120 - left - 104 + index * 16}" y="232" width="11" height="11" rx="2" fill="${color}"/>`).join('')}
    <text x="${1120 - left - 19}" y="242">More</text>
  </g>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" width="1120" height="250" viewBox="0 0 1120 250" role="img" aria-labelledby="${id}-title ${id}-description" style="max-width:100%;height:auto">
  <title id="${id}-title">${username}'s contribution galaxy</title>
  <desc id="${id}-description">${calendar.totalContributions} GitHub contributions. A small metallic UFO glides between contribution clusters, opening its tractor beam to collect the squares inside the cone. Collected squares stay empty until the next orbit.</desc>
  <defs>
    <linearGradient id="${id}-metal" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#f0f5f4"/><stop offset=".28" stop-color="#a8b9b9"/><stop offset=".48" stop-color="#dae2de"/><stop offset=".58" stop-color="#6a7e7c"/><stop offset="1" stop-color="#354744"/></linearGradient>
    <linearGradient id="${id}-dome" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#e2f4d8"/><stop offset=".5" stop-color="#9eb8a0"/><stop offset="1" stop-color="#456c5e"/></linearGradient>
    <linearGradient id="${id}-beam" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${options.beamColor}" stop-opacity=".54"/><stop offset=".55" stop-color="${options.beamColor}" stop-opacity=".3"/><stop offset="1" stop-color="${options.beamColor}" stop-opacity=".12"/></linearGradient>
    <radialGradient id="${id}-halo"><stop stop-color="${options.beamColor}" stop-opacity=".65"/><stop offset="1" stop-color="${options.beamColor}" stop-opacity="0"/></radialGradient>
    <filter id="${id}-soft" x="-60%" y="-30%" width="220%" height="160%"><feGaussianBlur stdDeviation="1.5"/></filter>
  </defs>
  <style>${scope} .contribution,${scope} .beam-window,${scope} .flight,${scope} .hull{transform-origin:0 0}
  ${scope} .flight{transform:${transform(scene.parked)}}
  ${scope} .beam-window{opacity:0;transform:scale(.2,0)}
${animationCss}</style>
  <rect width="1120" height="250" rx="16" fill="${theme.background}"/>
  ${stars}${labels}
  <g class="calendar">${cells.join('')}</g>
  <g class="tractor-beams">${beams.join('')}</g>
  <g class="flight"><g class="hull">
    <ellipse cx="0" cy="5" rx="20" ry="5" fill="url(#${id}-halo)" opacity=".5"/>
    <path d="M -10 -2 Q -9 -12 0 -12 Q 9 -12 10 -2 Z" fill="url(#${id}-dome)" stroke="#bdd0bc" stroke-width=".6"/>
    <path d="M -7 -5 Q -5 -10 0 -10" fill="none" stroke="#f3ffe4" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    <path d="M -20 0 Q -12 -5 0 -5 Q 12 -5 20 0 L 17 3 Q 0 8 -17 3 Z" fill="url(#${id}-metal)" stroke="#738e82" stroke-width=".65"/>
    <path d="M -18 2 Q 0 6 18 2 L 15 5 Q 0 8 -15 5 Z" fill="#233d30"/>
    <path d="M -16 -.5 Q 0 -5 16 -.5" fill="none" stroke="#f1ffe9" stroke-width=".6" opacity=".7"/>
    ${[-14, -7, 0, 7, 14].map((x) => `<ellipse cx="${x}" cy="${Math.abs(x) === 14 ? 2.4 : 3.6}" rx="1.45" ry=".85" fill="${options.beamColor}"/><ellipse cx="${x}" cy="${Math.abs(x) === 14 ? 2.4 : 3.6}" rx="2.1" ry="1.3" fill="${options.beamColor}" opacity=".2"/>`).join('')}
    <ellipse cx="0" cy="6" rx="4" ry="1" fill="${options.beamColor}" opacity=".8"/>
  </g></g>
</svg>`;
}
