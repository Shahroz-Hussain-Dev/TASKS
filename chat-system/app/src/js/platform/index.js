import * as electron from './electron.js';
import * as capacitor from './capacitor.js';
import * as web from './web.js';

export function createPlatform() {
  if (window.pigeonDesktop) return electron.create();
  if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) return capacitor.create();
  return web.create();
}
