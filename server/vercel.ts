import { app } from './app';
import { bootstrapSystem } from './bootstrap';

// Initialize in-memory dataset in Vercel serverless environment
bootstrapSystem().catch((err) => {
  console.warn('[Vercel Serverless Bootstrap Notice]:', err?.message || err);
});

export default app;
