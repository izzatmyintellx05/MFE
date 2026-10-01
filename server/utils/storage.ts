import fs from 'fs';
import path from 'path';

const storageDir = process.env.STORAGE_DIR || 'uploads_storage';

if (!fs.existsSync(storageDir)) {
  fs.mkdirSync(storageDir, { recursive: true });
}

export function saveFileToStorage(tempPath: string, newFilename: string): string {
  const destination = path.join(storageDir, newFilename);
  fs.copyFileSync(tempPath, destination);
  fs.unlinkSync(tempPath);
  return destination;
}

export function deleteStorageFile(storagePath: string): void {
  if (fs.existsSync(storagePath)) {
    fs.unlinkSync(storagePath);
  }
}