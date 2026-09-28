// Copies the shared built web app (../app/www) into ./www before packaging.
import { cpSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '..', 'app', 'www');
if (!existsSync(path.join(src, 'app.js'))) { console.error('Shared app not built. Run `npm run build` in ../app first.'); process.exit(1); }
rmSync(path.join(here, 'www'), { recursive: true, force: true });
cpSync(src, path.join(here, 'www'), { recursive: true });
console.log('www synced');
