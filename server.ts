import dotenv from 'dotenv';
dotenv.config();

// Ensure JWT_SECRET is present
process.env.JWT_SECRET = process.env.JWT_SECRET || 'mfe-formwork-mr11-enterprise-secret-key-2026';

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import express from 'express';
import { app } from './server/app';
import { bootstrapSystem } from './server/bootstrap';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let port = Number(process.env.PORT) || 3000;
const portArgIdx = process.argv.indexOf('--port');
if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
  port = Number(process.argv[portArgIdx + 1]) || port;
}
const PORT = port;

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';
  const distDir = path.resolve(__dirname, 'dist');

  if (!isProduction || !fs.existsSync(distDir)) {
    // In development mode, use Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production mode, serve built frontend
    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MFE Formwork MR11] Server running on http://0.0.0.0:${PORT}`);
    // Bootstrap data in background
    bootstrapSystem().catch((err) => {
      console.warn('[MFE Formwork MR11] Background bootstrap error:', err);
    });
  });
}

startServer().catch((err) => {
  console.error('[MFE Formwork MR11] Failed to start server:', err);
  process.exit(1);
});
