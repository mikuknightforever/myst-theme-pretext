# Automatic-content smoke test

This is a development fixture, not the finished installer. It deliberately has no
`pretext-draggable` classes. Use the built article theme from this repository.

From this directory, run `bunx mystmd start --port 3001`, open the article, then
open Pretext Mode. Switch between one, two and three columns and vary the font size.

The project now enables the automatic entry and intentionally keeps its old
directive. The index must have exactly one launch button. The disabled legacy
page must have none. For a fixture without any directives or plugins, see the
sibling `auto-entry` example.

Check that the regular figure and plain Markdown image become cards; their
captions, existing numbering and surrounding prose remain intact. Linked images,
mixed inline images, equations, tables, code, nested/ordered/task lists and
footnotes must remain visible. The counter must increment. An intentionally
unregistered extension must display a notice and its available text.

The demo plugin only supplies the launch button and local test nodes. It does not
mark images, rewrite the source article, or alter the column algorithm.
