import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Use each workspace's installed tools, including its own Vitest instance.
// Invoking the root Vitest against another installed copy can silently miss tests.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = [
  ['Pretext', 'packages/pretext-widget', ['src'], ['src/**/*.{ts,tsx}'], []],
  [
    'Article theme',
    'themes/article',
    ['app', 'tests'],
    ['app/**/*.{ts,tsx}', 'tests/**/*.ts'],
    ['tests'],
  ],
];

function run(cwd, label, packageName, entry, args) {
  const require = createRequire(join(cwd, 'package.json'));
  const tool = join(dirname(require.resolve(`${packageName}/package.json`)), entry);
  process.stdout.write(`\n${label}\n`);
  const result = spawnSync(process.execPath, [tool, ...args], { cwd, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// A fresh checkout has no declarations for linked workspace dependencies.
// Use their ESM tasks in dependency order, avoiding POSIX-only clean scripts.
run(root, 'Article workspace dependencies: build', 'turbo', 'bin/turbo', [
  'run',
  'build:esm',
  '--filter=@myst-theme/article^...',
]);

for (const [name, relative, lintPaths, formatPaths, testPaths] of targets) {
  const cwd = join(root, relative);
  run(cwd, `${name}: lint`, 'eslint', 'bin/eslint.js', [
    ...lintPaths,
    '--ext',
    '.ts,.tsx',
    '--max-warnings',
    '0',
  ]);
  run(cwd, `${name}: format`, 'prettier', 'bin/prettier.cjs', ['--check', ...formatPaths]);
  // Build the library before checking the theme's imports on a clean checkout.
  if (relative === 'packages/pretext-widget') {
    // Only replace this package's generated output, never follow a dist symlink.
    const output = resolve(cwd, 'dist');
    if (output !== join(root, 'packages', 'pretext-widget', 'dist')) {
      throw new Error('Unexpected library output path');
    }
    if (existsSync(output) && lstatSync(output).isSymbolicLink()) {
      throw new Error('Refusing to remove a linked library output directory');
    }
    rmSync(output, { recursive: true, force: true });
    run(cwd, `${name}: build`, 'typescript', 'bin/tsc', ['--project', 'tsconfig.build.json']);
  }
  run(cwd, `${name}: types`, 'typescript', 'bin/tsc', ['--noEmit', '--skipLibCheck']);
  run(cwd, `${name}: tests`, 'vitest', 'vitest.mjs', ['run', ...testPaths, '--threads', 'false']);
}

process.stdout.write('\nPretext quality checks passed.\n');
