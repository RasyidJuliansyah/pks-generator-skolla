// Nama yang TIDAK BOLEH sampai ke peramban, diturunkan dari sumbernya sendiri.
//
// Sengaja diturunkan, bukan dipatok di daftar: pemindai yang memaku 'opencode.ai' berhenti
// menjaga begitu hostnya berganti, dan ia tetap hijau sambil tidak memeriksa apa pun -- bentuk
// jimat yang sudah beberapa kali menggigit proyek ini. Dipakai dua tempat yang memang harus
// sepakat: `uji/ekstraksi-bundel.test.mjs` (graf impor, jalan tiap `periksa`) dan
// `uji/pindai-bundel.mjs` (isi chunk hasil build, jalan tiap `npm run build`).
import { readFileSync } from 'node:fs';

const BERKAS = new URL('../lib/penyedia-ekstraksi.ts', import.meta.url);

export function terlarangKlien() {
  const s = readFileSync(BERKAS, 'utf8');
  const kunci = s.match(/process\.env\.([A-Z0-9_]+)/)?.[1];
  const model = s.match(/MODEL_EKSTRAKSI\s*=\s*'([^']+)'/)?.[1];
  const host = [...s.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)].map((m) => m[1]);
  if (!kunci || !model || !host.length) {
    throw new Error('tidak bisa menurunkan nama terlarang dari lib/penyedia-ekstraksi.ts; '
      + 'pemindai ini perlu ditinjau sebelum diandalkan');
  }
  return { kunci, model, host: [...new Set(host)] };
}
