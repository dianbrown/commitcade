function theme(background, empty, levels, text) {
  return Object.freeze({ background, empty, levels: Object.freeze(levels), text });
}

export const themes = Object.freeze({
  'github-dark': theme('#0d1117', '#212830', ['#0e4429', '#006d32', '#26a641', '#39d353'], '#9198a1'),
  'github-light': theme('#ffffff', '#ebedf0', ['#9be9a8', '#40c463', '#30a14e', '#216e39'], '#59636e'),
  midnight: theme('#080c1b', '#1b2440', ['#17484c', '#177668', '#2dba83', '#92efb0'], '#94a4bf'),
});
