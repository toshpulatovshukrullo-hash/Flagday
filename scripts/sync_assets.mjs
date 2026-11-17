// Copy user-supplied assets into Remotion's public/ dir (logo is copied byte-for-byte, never modified).
import fs from 'node:fs';
for (const [src, dst] of [['assets/logo_terdu.png', 'public/logo_terdu.png'], ['assets/humo.glb', 'public/humo.glb']]) {
  if (fs.existsSync(src)) { fs.copyFileSync(src, dst); console.log('synced', src, '→', dst); }
  else if (src.endsWith('.png')) console.warn('MISSING', src, '— a placeholder will be used');
}
