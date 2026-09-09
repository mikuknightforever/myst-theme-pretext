# Article startup navigation regression

From the repository root (using the installed dependencies):

Run `bun run quality:pretext` to check both the Pretext package and this theme.
To run only the startup tests and theme types:

```powershell
cd themes/article
node ../../node_modules/vitest/vitest.mjs run tests --threads false
node ../../node_modules/typescript/bin/tsc --noEmit --skipLibCheck
```

The 20 tests cover path/query mismatches before script execution, between
scheduling and rendering, and before the first commit; hash-only navigation;
normal SPA navigation after startup; static URL relocation; unavailable storage;
repeated recovery; and the installed router's stale-hydration-data behavior.

## Browser regression

Build the article theme, then serve
`packages/pretext-widget/examples/auto-entry` with `bunx mystmd start --port 3002`.
Restart an already running production server after rebuilding the theme.

1. Open Alpha, follow its link to the opted-out article, refresh and immediately
   go Back, without waiting for client initialization. Verify Alpha's actual
   content and its single entry return, not just the browser URL.
2. Go Forward, then Back, refresh and immediately go Forward. Verify the disabled
   article's content returns without an entry or old overlay.
3. Repeat from `/?view=paper#alpha-content`. Both the query and hash must survive.
   The recovery action must use `location.reload()`, not
   `location.replace(location.href)`: the latter can be only a same-document
   fragment navigation and leave stale content in place.
4. Repeat with `site.options.pretext: false` temporarily set in the fixture.
   Alpha and the disabled page must remain entry-free. Restore the fixture after
   testing.
5. Navigate Alpha -> Beta -> Gamma through links inside Pretext. Each old overlay
   must close. Beta has no figure, Gamma has its own one figure, and neither may
   inherit the preceding article's content.

The guard reloads only a mismatched startup document. Once hydration commits,
ordinary SPA transitions are left to Remix. It does not patch route modules,
change article Markdown, or alter the column-layout algorithm.
