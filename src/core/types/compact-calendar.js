import { escapeXml, svgId } from '../svg.js';

export const number = (value) => Number(value.toFixed(4));

export function compactLayout(calendar) {
  const columns = Math.max(53, calendar.weeks.length);
  const pitch = 18;
  const size = 13;
  const gridTop = 38;
  const left = (1120 - ((columns - 1) * pitch + size)) / 2;
  const active = calendar.weeks.flatMap((week, column) => week.contributionDays
    .filter((day) => day.contributionCount > 0)
    .map((day) => ({ ...day, column, x: left + column * pitch + size / 2,
      y: gridTop + day.weekday * pitch + size / 2 })));
  return { columns, pitch, size, gridTop, left, active };
}

export function compactTimeline(type, calendar, options, duration) {
  const id = svgId(JSON.stringify([type, calendar, options]));
  const css = [];
  const animate = (name, events, delay = 0) => {
    if (!options.animation) return;
    css.push(`#${id} .${name}{animation:${id}-${name} ${number(duration / options.speed)}s ${number(delay / options.speed)}s linear infinite}
      @keyframes ${id}-${name}{${events.map(([time, style]) => `${number(time / duration * 100)}%{${style}}`).join('')}}`);
  };
  return { id, css, animate };
}

/** Shared compact calendar for new styles; motion is layered above untouched cells. */
export function compactSvg(calendar, options, theme, { id, title, description, layout, css,
  classes = new Map(), movingDates = new Set(), underlay = '', actors = '', foreground = '' }) {
  const { columns, pitch, size, gridTop, left } = layout;
  const backgrounds = [];
  const cells = [];
  const moving = [];
  const labels = [];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let previousMonth = '';
  let previousColumn = -4;
  for (let column = 0; column < columns; column++) {
    const days = calendar.weeks[column]?.contributionDays ?? [];
    const x = left + column * pitch;
    for (const day of days) {
      const month = day.date.slice(0, 7);
      if (month !== previousMonth) {
        if (column - previousColumn >= 3) {
          labels.push(`<text x="${x}" y="26">${months[Number(day.date.slice(5, 7)) - 1]}</text>`);
          previousColumn = column;
        }
        previousMonth = month;
      }
    }
    for (let row = 0; row < 7; row++) {
      const day = days.find((entry) => entry.weekday === row);
      const y = gridTop + row * pitch;
      const cellTitle = day ? `${day.date}: ${day.contributionCount} contributions` : 'No contribution data';
      backgrounds.push(`<rect class="empty-cell" x="${x}" y="${y}" width="${size}" height="${size}" rx="2" fill="${theme.empty}"${day ? ` data-date="${day.date}" data-count="${day.contributionCount}"` : ''}><title>${cellTitle}</title></rect>`);
      if (day?.contributionCount > 0) (movingDates.has(day.date) ? moving : cells).push(
        `<g transform="translate(${x + size / 2} ${y + size / 2})"><g class="contribution ${classes.get(day.date) ?? 'untouched'}"><rect x="-6.5" y="-6.5" width="13" height="13" rx="2" fill="${theme.levels[day.contributionLevel - 1]}"><title>${cellTitle}</title></rect></g></g>`);
    }
  }
  const username = escapeXml(calendar.username || 'GitHub');
  return `<svg xmlns="http://www.w3.org/2000/svg" id="${id}" width="1120" height="190" viewBox="0 0 1120 190" role="img" aria-labelledby="${id}-title ${id}-desc" style="max-width:100%;height:auto">
    <title id="${id}-title">${username}'s ${title} contribution graph</title>
    <desc id="${id}-desc">${calendar.totalContributions} contributions. ${description}</desc>
    <style>#${id} .effect{opacity:0}${css.join('\n')}${options.animation ? `
      @media(prefers-reduced-motion:reduce){#${id} *{animation:none!important}#${id} .effect{display:none!important}#${id} .contribution{opacity:1!important;transform:none!important}}` : ''}</style>
    <rect width="1120" height="190" rx="12" fill="${theme.background}"/>
    <g class="calendar-background">${backgrounds.join('')}</g>${underlay}<g class="calendar">${cells.join('')}</g>${actors}<g class="moving-cells">${moving.join('')}</g>${foreground}
    ${options.showLabels ? `<g class="labels" fill="${theme.text}" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif" font-size="10">${labels.join('')}
      <text x="${left - 30}" y="66">Mon</text><text x="${left - 30}" y="102">Wed</text><text x="${left - 30}" y="138">Fri</text>
      <text x="${left}" y="180">${calendar.totalContributions.toLocaleString('en-US')} contributions · @${username}</text>
      <text x="${1120 - left - 135}" y="180">Less</text>${[theme.empty, ...theme.levels].map((color, i) => `<rect x="${1120 - left - 104 + i * 16}" y="170" width="11" height="11" rx="2" fill="${color}"/>`).join('')}<text x="${1120 - left - 19}" y="180">More</text></g>` : ''}
  </svg>`;
}
