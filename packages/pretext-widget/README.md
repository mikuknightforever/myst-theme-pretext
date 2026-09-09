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

## Theme integration

The package exports `PretextArticle` and `PRETEXT_RENDERERS`. A compatible theme
registers the renderers as before and wraps the article body in `PretextArticle`,
inside its article and site providers. Pass an `articleId` unique across projects
and routes. The article provider must expose the resolved AST as
`references.article`; page options come from `frontmatter.site`, and site options
come from `siteManifest.options`.

The integration reads the AST without rewriting it. Standard static figures are
detected automatically; compound/linked/interactive content retains its native
renderer. Unsupported extensions display a notice and their available content.

## Development acceptance fixtures

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
