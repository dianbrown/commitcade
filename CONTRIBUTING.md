# Contributing to Commitcade

Thanks for helping turn contribution calendars into tiny arcade scenes.

## Develop locally

Use Node.js 22.12 or newer and npm. Fork or clone the repository, then run:

```sh
npm ci
npm run demo
```

Before opening a pull request, run `npm run check`. This runs the Node test suite. Use `node cli/index.js --demo --output generated/check.svg` for a deterministic, offline rendering check. Open the SVG in a browser and check both light and dark backgrounds; check `--static` as well.

Keep core rendering, the CLI, and the action free of dependencies. Tests should use synthetic calendars and injected fetch implementations instead of live GitHub requests or personal tokens.

## Add a graph type

The public `graphTypes` export from `src/core/index.js` is the type registry. Each entry has an `id`, `name`, and `description`. Start by reading the existing UFO renderer and the registry implementation under `src/core/`.

1. Implement a renderer for the normalized calendar and shared options. Produce a complete, self-contained SVG string with no scripts or external resources.
2. Add its metadata to the registry and connect it to `renderGraph(calendar, options)` dispatch. The registry is source code, not a runtime plugin installation system.
3. Support the shared themes, beam color and size, flight personality, speed, labels, stars, and static rendering where applicable. Escape any user-controlled text inserted into SVG.
4. Add deterministic rendering tests, including empty calendars, invalid inputs, and static output. Expose any new options through the CLI, action, and JavaScript API as appropriate.
5. Update README examples and action input descriptions. CLI validation and help read the registry; the action produces `<type>-contribution-graph.svg` and `<type>-contribution-graph-dark.svg` for each selected type.

Use lowercase IDs containing only letters, numbers, and hyphens so generated filenames stay portable. Do not advertise a type or output format before it is implemented and tested.

## Pull requests and issues

Explain the problem, the resulting behavior, and how you verified it. Include before/after screenshots or SVGs for visual changes. Keep changes focused and avoid unrelated formatting. For bugs, provide the command or Action inputs, Node/browser version, and a minimal reproduction. Never include access tokens or private contribution data in an issue.

Commitcade is an original implementation inspired by arcade contribution graphs, including [pacman-contribution-graph](https://github.com/abozanona/pacman-contribution-graph). Submit only code and assets that you have the right to contribute under the project's [MIT license](LICENSE).
