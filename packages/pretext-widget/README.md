# Pretext for MyST articles

Pretext provides adjustable columns, draggable static figures and native MyST
content rendering. The current development integration is included in this
repository's **article theme**. It is not yet a published, standalone installer.

## Enable the entry without changing article content

In a project already using this repository's article theme, add to `myst.yml`:

```yaml
site:
  # Keep the project's existing template setting pointing to this article theme.
  options:
    pretext: true
```

Keep any other existing `site` options. This adds one entry to each nonempty
article. Neither a `{pretext-widget}` directive nor a `pretext-draggable` image
class is required. No Pretext parsing plugin is needed for ordinary articles.
Other plugins used by an article's own interactive content are still required.

The option is specific to the integrated theme; adding it to an unrelated stock
theme does not install the React component or its dependencies.

## Override one page

Use the page's existing YAML frontmatter:

```yaml
---
title: Example page
site:
  pretext: false
---
```

A page's boolean overrides the site's boolean. Page `true` can opt in even when
the site is `false`. If neither supplies a boolean, only legacy directive entries
are rendered, preserving the previous default. Explicit `false` disables both
automatic and legacy entries. Use YAML booleans, not quoted strings.

When automatic mode meets an existing directive, there is still only one entry:
the automatic entry replaces directive launchers and preserves the first
directive's optional custom image selector. Old directives may stay in the source
for compatibility; a parser for those directives is still needed to parse them.

Changing article identity resets the entry session. Replacing its resolved AST
closes an open overlay, preventing the previous content/measurements from being
reused. Reading preferences such as font size remain shared by the existing
reading-settings implementation.

## Reading controls

The automatic entry is a round flask icon beside the theme switcher, so it takes no
space in the article. A theme can place an element with id `pretext-launcher-slot`
where the icon should go; without one the icon is fixed to the top right. Legacy
`{pretext-widget}` directives still show their inline card where the author put it.

The first time a reader opens it, a small welcome card at the top explains, in
plain words, what the reader does and that figures can be moved and resized. It
is dismissed with "Start reading" (or Esc) and not shown again on that device.

In Pretext mode a translucent toolbar floats at the bottom; every item shows a
tooltip on hover or keyboard focus:

- **Columns**: an icon that opens 1 to 4 columns (a count is disabled when the width
  cannot fit it).
- **Justify**: toggles justified text. Justified paragraphs choose their line
  breaks for the whole paragraph (minimum raggedness, the idea behind Knuth–Plass)
  instead of filling lines greedily, then stretch every line but the last to its
  column. A paragraph split across columns keeps the breaks chosen for the whole
  paragraph. Only lines whose gaps would exceed about 5 spaces stay left aligned.
  Paragraphs beside a moved figure use greedy breaks. Citations and links break
  between their words (each piece keeps the link and hover preview), so a long
  reference no longer leaves the line before it ragged.
- **Aa**: font size, line height, paragraph spacing and page width (how wide the article area can get).
- **Text effects**, after learn-pretext.com (Scatter is on by default): none (–), Scatter (words flee a fast
  cursor), Magnify (a gentle lens: words within 100 px grow up to 1.25×, each only
  as far as the gaps around it allow, so nothing overlaps or moves), Explode
  (click the text), and Leaves (the Evidence logo floats around the page and
  every few seconds fires its three leaves, plus smaller copies, outward; they
  slow down and flutter off the page while the logo grows new ones, and clicking
  the logo fires a volley straight away). The rows around the logo and each leaf
  part: a gap opens where it is, taken from the spaces between the other words on
  the row, so words never overlap or move past the edge of the text. Scatter uses a damped spring per word pulled back to its
  laid-out position; effects only change how words are drawn, never the layout,
  and are disabled when the system asks for reduced motion.
- **On this page** (wide screens) and Exit. The theme switch stays where the
  article has it, at the top right.

Text appears as soon as it is laid out, and the words on screen immediately do a
Mexican wave: a front sweeps diagonally and each word stands up and sits back
down (about 1.3 s). Notebook charts inside figure cards (Plotly takes over a
second of main-thread work) mount only after the wave, so it runs at full frame
rate; until then each card shows a still placeholder at its final size, measured
from the same figure in the article behind the overlay.
Changing the column count moves every word from where it was on screen to its new
place over 450 ms. Both are skipped for reduced motion.

Figure cards show their frame and move/resize controls only on hover (always on
touch screens). The caption identifies the figure; there is no extra label. A card
the reader resized keeps the figure's proportions: its height follows its width,
so the figure fills the card and the caption sits right under it. If the caption
would be taller than most of the figure, it collapses into a "Caption" toggle
directly under the figure; opening it keeps the width and adds the caption below.
Moved figures keep the column groups and their dividers.

Layout follows pretext's pipeline: each word's width is measured once per font and
kept with the word; columns are filled by laying a paragraph out once and taking
its lines while they fit; partial layouts are combined without copying; and while
no figure has been moved, the figure-placement pass is reused as the final layout.
Citations, links and math are measured in the DOM once per font size, never for
line-height or spacing changes.

## Theme integration

The package exports `PretextArticle` and `PRETEXT_RENDERERS`. `PretextArticle`
takes an optional `header`, drawn above the columns in Pretext mode; the article
theme passes its article header card. A compatible theme
registers the renderers as before and wraps the article body in `PretextArticle`,
inside its article and site providers. Pass an `articleId` unique across projects
and routes. The article provider must expose the resolved AST as
`references.article`; page options come from `frontmatter.site`, and site options
come from `siteManifest.options`.

The integration reads the AST without rewriting it. Standard static figures are
detected automatically. A figure whose body is a single notebook output (for
example a Plotly chart) also becomes a card: it is dragged by its header strip so
the output keeps hover, zoom and pan, and it is rendered at article width and
scaled to the card's size. The figure goes through MyST's own figure renderer, so
notebook outputs keep their source bar and compute controls (such as the power
button), scaled together with the output. Compound, linked and other interactive content retains
its native renderer. Unsupported extensions display a notice and their available content.

## Development acceptance fixtures

From the repository root, run `bun run quality:pretext` (or
`node scripts/check-pretext.mjs`) before changing the renderer or layout engine.
It first builds the article theme's workspace dependencies in dependency order,
then runs zero-warning lint, format checks, a clean library build, type checks
and both the package and article-theme tests. Dependency builds update their
generated output; only Pretext's `dist` directory is deleted and recreated.
Source files are not auto-fixed. Build configuration
excludes tests from published output, while type checks still include them.

The `Pretext quality` workflow runs these checks on Windows and Linux for
Pretext feature-branch pushes and relevant pull requests. The workflow must pass
on GitHub before claiming remote CI verification; a local pass alone is not one.
For module boundaries and refactoring guidance, see [ARCHITECTURE.md](ARCHITECTURE.md).

- `examples/auto-entry`: no plugins, no Pretext directives, multiple articles,
  a text-only article, an explicit page opt-in and a page-level opt-out. Run `bunx mystmd start --port 3002`
  in that directory after building this repository's article theme.
- `examples/auto-content`: automatic mode alongside legacy directives and rich
  interactive content. Run on port 3001. Check one entry on the index and no entry
  on the disabled legacy page.
- An existing project with no `pretext` option should retain its manual entry.

Test opening/closing, one/two/three columns, internal article navigation, browser
back/forward, and a hard refresh on an opted-out page. Cross-article navigation
must not leave an old overlay or duplicate entry mounted.

## Host-theme startup navigation protection

The article theme starts hydration immediately instead of waiting for an idle
callback. During startup it checks that the server-rendered document path and
query match the browser's current address. If Back/Forward changed that address,
it reloads the current history entry before initializing a router with stale
server data. Query strings, hashes and history are preserved. This prevents the
reproduced missing-route-module (`reading 'links'`) failure independently of
whether Pretext is enabled.

The check stops after the first hydration commit, so ordinary client-side
navigation remains client-side. A session-scoped recovery record prevents a
stale response from causing repeated automatic reloads. If recovery cannot be
recorded or repeats for the same target, the theme offers a manual reload page.
Static exports omit the server-path marker because their host may rename or
relocate HTML files; their existing document-navigation behavior is unchanged.

Startup guard tests and browser reproduction steps are documented in
[`themes/article/tests/README.md`](../../themes/article/tests/README.md).
