import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { settings } from '../../../config.js';
export const projectRoot = fileURLToPath(new URL('../../../../../../', import.meta.url));
export const cacheRoot = resolve(settings.CACHE_ROOT ?? resolve(projectRoot, 'data/cache'));
