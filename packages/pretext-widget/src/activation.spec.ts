import { describe, expect, it } from 'vitest';
import { resolvePretextMode } from './activation.js';

describe('Pretext activation precedence', () => {
  it.each([
    [undefined, undefined, 'manual'],
    [true, undefined, 'automatic'],
    [false, undefined, 'disabled'],
    [true, false, 'disabled'],
    [false, true, 'automatic'],
    [undefined, true, 'automatic'],
    [undefined, false, 'disabled'],
    [true, true, 'automatic'],
    [false, false, 'disabled'],
    [true, null, 'automatic'],
    [false, null, 'disabled'],
    ['false', undefined, 'manual'],
    ['true', undefined, 'manual'],
    [true, 'false', 'automatic'],
    [false, { enabled: true }, 'disabled'],
    [null, null, 'manual'],
  ])('site %j, page %j -> %s', (site, page, expected) => {
    expect(resolvePretextMode(site, page)).toBe(expected);
  });
});
