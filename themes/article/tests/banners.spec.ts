import { describe, expect, it } from 'vitest';
import { FALLBACK_BANNERS, fallbackBanner, withBanner } from '../app/utils/banners';

const paper = (n: number, banner?: string) => ({ slug: `paper-${String(n).padStart(5, '0')}`, banner });

describe('fallback banners', () => {
  it('keeps a banner the paper sets itself', () => {
    const project = paper(41, '/banner-own.jpg');
    expect(withBanner(project, [project])).toBe(project);
  });

  it('gives each paper without a banner the next Evidence banner, in slug order', () => {
    const site = [paper(10), paper(4, '/own.jpg'), paper(2), paper(7)];
    expect(site.filter((p) => !p.banner).map((p) => fallbackBanner(p, site))).toEqual([
      FALLBACK_BANNERS[2], // paper-00010 is third without a banner
      FALLBACK_BANNERS[0], // paper-00002
      FALLBACK_BANNERS[1], // paper-00007
    ]);
  });

  it('uses all seven before repeating one', () => {
    const site = Array.from({ length: 10 }, (_, i) => paper(i + 1));
    const banners = site.map((p) => fallbackBanner(p, site));
    expect(new Set(banners.slice(0, 7)).size).toBe(7);
    expect(banners[7]).toBe(FALLBACK_BANNERS[0]);
  });

  it('keeps earlier papers unchanged when a paper is added at the end', () => {
    const site = Array.from({ length: 5 }, (_, i) => paper(i + 1));
    const before = site.map((p) => fallbackBanner(p, site));
    const grown = [...site, paper(99)];
    expect(site.map((p) => fallbackBanner(p, grown))).toEqual(before);
  });

  it('still gives a banner when the site list is missing', () => {
    expect(FALLBACK_BANNERS).toContain(withBanner(paper(3)).banner);
  });
});
