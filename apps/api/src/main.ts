import { createApp } from './bootstrap.js';
import { settings } from './config.js';

const app = await createApp();
await app.listen(settings.API_PORT, settings.API_HOST);
console.info(`API: http://${settings.API_HOST}:${settings.API_PORT}/api/v1 (scaffold)`);
