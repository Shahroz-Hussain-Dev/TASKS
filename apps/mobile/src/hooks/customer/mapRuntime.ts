/**
 * MapLibre runtime wiring for the bundled app.
 *
 * MapLibre 6 locates its worker with `new URL("./maplibre-gl-worker.mjs",
 * import.meta.url)`, which Vite cannot rewrite inside a dependency, so the
 * production bundle would ask for a file that does not exist and no tile
 * would ever render. Pointing it at the worker Vite bundles for us fixes that.
 * Importing this module anywhere before the first map mounts is enough.
 */
import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

let configured = false;

export function ensureMapRuntime(): void {
  if (configured) return;
  configured = true;
  maplibregl.setWorkerUrl(workerUrl);
}

ensureMapRuntime();
