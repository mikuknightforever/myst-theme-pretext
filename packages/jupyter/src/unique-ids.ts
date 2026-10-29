import type { IOutput } from '@jupyterlab/nbformat';

/**
 * Charting libraries (Plotly, Bokeh, Altair) write HTML outputs that draw into
 * an element with a generated id, looked up with document.getElementById. When
 * the same output is on the page twice (the article and Pretext mode both
 * render it), the lookup returns the first copy, so the chart is drawn there
 * again and the second copy stays empty.
 *
 * Giving each rendered copy its own ids keeps the copies apart. Only ids that
 * look generated are rewritten (long, containing a digit), so ordinary words
 * that are also ids, such as "number" in an embedded library, are left alone.
 */
const ID_ATTRIBUTE = /\bid\s*=\s*["']([^"']+)["']/g;
const GENERATED_ID = /^(?=.*\d)[A-Za-z0-9_-]{16,}$/;

export function generatedIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(ID_ATTRIBUTE)) {
    if (GENERATED_ID.test(match[1])) ids.add(match[1]);
  }
  return [...ids];
}

/** The HTML with every generated id, and every mention of it, given the suffix. */
export function withUniqueIds(html: string, suffix: string): string {
  let result = html;
  for (const id of generatedIds(html)) {
    result = result.split(id).join(`${id}-${suffix}`);
  }
  return result;
}

/** The output with the ids in its HTML made unique to one rendered copy. */
export function outputWithUniqueIds(output: IOutput, suffix: string): IOutput {
  const data = (output as { data?: Record<string, unknown> }).data;
  const html = data?.['text/html'];
  if (html == null) return output;
  const rewrite = (text: string) => withUniqueIds(text, suffix);
  const updated = Array.isArray(html) ? html.map((part) => rewrite(String(part))) : rewrite(String(html));
  return { ...output, data: { ...data, 'text/html': updated } } as IOutput;
}
