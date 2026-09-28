// Bundles the shared web app into ./www (consumed by both the desktop and mobile wrappers).
import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(root, 'www');
const watch = process.argv.includes('--watch');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(path.join(root, 'src/index.html'), path.join(out, 'index.html'));
cpSync(path.join(root, 'src/styles.css'), path.join(out, 'styles.css'));
if (existsSync(path.join(root, 'src/icon.png'))) cpSync(path.join(root, 'src/icon.png'), path.join(out, 'icon.png'));

const opts = {
  entryPoints: [path.join(root, 'src/js/app.js')],
  bundle: true,
  format: 'iife',
  target: ['chrome110'],
  outfile: path.join(out, 'app.js'),
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': watch ? '"development"' : '"production"' },
};
if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  console.log('watching…');
} else {
  await esbuild.build(opts);
}
