import { describe, expect, it } from 'vitest';
import { LruCache } from './lru-cache.js';

describe('bounded measurement cache', () => {
  it('retains recently read entries and evicts the least recent', () => {
    const cache = new LruCache<number>(2);
    cache.set('a', 0);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(0);
    cache.set('c', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe(0);
    expect(cache.get('c')).toBe(3);
  });

  it('updates an entry without evicting another one', () => {
    const cache = new LruCache<number>(2);
    cache.set('', 1);
    cache.set('b', 2);
    cache.set('', 3);
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBe(2);
    expect(cache.get('')).toBe(3);
  });

  it('stays bounded through many article/font measurement keys', () => {
    const cache = new LruCache<number>(100);
    for (let i = 0; i < 50_000; i += 1) cache.set(`article-word-font-${i}`, i);
    expect(cache.size).toBe(100);
    expect(cache.get('article-word-font-0')).toBeUndefined();
    expect(cache.get('article-word-font-49999')).toBe(49_999);
  });

  it.each([0, -1, 1.5, Infinity, NaN])('rejects invalid capacity %s', (capacity) => {
    expect(() => new LruCache(capacity)).toThrow(RangeError);
  });
});
