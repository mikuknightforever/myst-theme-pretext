/**
 * Evidence banners for papers that do not set their own. The papers without a
 * banner, in order of their slugs, take the banners in turn, so all seven are
 * used and neighbouring papers differ. The choice depends only on the site's
 * list, so the server and the browser draw the same banner, and a paper added
 * at the end of the list does not change the banners of the others.
 */
export const FALLBACK_BANNERS = [1, 2, 3, 4, 5, 6, 7].map(
  (n) => `https://raw.githubusercontent.com/evidencepub/brand/main/banner/png/article_hdr_${n}.jpg`,
);

type Project = { banner?: string | null; slug?: string };

export function fallbackBanner(project: Project, projects: Project[] = []): string {
  const without = projects
    .filter((p) => !p.banner && p.slug)
    .map((p) => p.slug as string)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const position = project.slug ? without.indexOf(project.slug) : -1;
  return FALLBACK_BANNERS[Math.max(0, position) % FALLBACK_BANNERS.length];
}

/** The project as given, or with a fallback banner when it has none. */
export function withBanner<T extends Project>(project: T, projects: Project[] = []): T {
  if (project.banner) return project;
  return { ...project, banner: fallbackBanner(project, projects) };
}
