import { app } from './app';
import { ensureBootstrapped } from './bootstrap';

// Start loading the instance's data from Supabase right away; requests wait for it (server/app.ts)
ensureBootstrapped();

export default app;
