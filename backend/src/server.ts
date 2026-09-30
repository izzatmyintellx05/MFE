import dotenv from 'dotenv';
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('[MFE System Backend] JWT_SECRET is not set. Refusing to start.');
  process.exit(1);
}

import app from './app';

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[MFE System Backend] Running on http://localhost:${PORT}`);
});
