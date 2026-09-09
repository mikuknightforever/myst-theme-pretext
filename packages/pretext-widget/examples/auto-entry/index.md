---
title: Alpha article — automatic entry
---

## Alpha content

ALPHA-ONLY-CONTENT. This article has no Pretext directive, image class or parsing
plugin. Its entry is enabled by the project configuration alone. The words in this
paragraph belong to the first article and must not appear in the second article's
reading mode.

:::{figure} diagram.svg
:name: alpha-figure

An ordinary figure in the Alpha article. Its source numbering is preserved.
:::

The surrounding prose must remain in order. A figure can be resized or moved in
Pretext; switching to another article must not carry its position into that page.

```{math}
:label: alpha-equation
f(x)=x^2+2x+1
```

## Navigate between articles

Open [the text-only Beta article](second.md) or [the opted-out article](disabled.md).
Try those links while Pretext is open, then use browser Back and Forward. Each
article must show its own content, with at most one entry and no stale overlay.

ALPHA-END. This final paragraph belongs only to the first article.
