export type PretextMode = 'automatic' | 'manual' | 'disabled';

/** Page booleans override site booleans; omitted/invalid options keep legacy behavior. */
export function resolvePretextMode(siteOption: unknown, pageOption: unknown): PretextMode {
  const enabled = typeof pageOption === 'boolean' ? pageOption : siteOption;
  if (enabled === true) return 'automatic';
  if (enabled === false) return 'disabled';
  return 'manual';
}
