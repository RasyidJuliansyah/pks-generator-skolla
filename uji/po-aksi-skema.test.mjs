// Aksi server tanda tangan membaca pihak wajib dari skema PO, bukan angka 3 (catatan/23).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../lib/po-aksi.ts', import.meta.url), 'utf8');
const badan = (nama) => {
  const i = src.indexOf(`export async function ${nama}(`);
  assert.ok(i >= 0, `${nama} tidak ditemukan`);
  const j = src.indexOf('\nexport ', i + 1);
  return src.slice(i, j < 0 ? undefined : j);
};
for (const f of ['simpanTtd', 'ajukanVerifikasi']) {
  const b = badan(f);
  assert.doesNotMatch(b, /[<>]=?\s*3\b/, `${f} masih membandingkan dengan 3 harfiah`);
  assert.match(b, /pihakUntuk\(skemaDari\(/, `${f} tidak membaca pihak wajib dari skema PO`);
}
for (const f of ['kirimUntukTtd', 'kembalikanKeDraf']) {
  assert.match(badan(f), /SEMUA_PIHAK\.map/, `${f} tidak menghapus berkas keempat pihak`);
}
assert.doesNotMatch(src, /URUT_PIHAK/, 'po-aksi masih memakai URUT_PIHAK');
console.log('  OK  aksi tanda tangan membaca skema PO');

// Teks layar jalur unggah tidak boleh menjanjikan TIGA tanda tangan: PO unggahan skema 4
// mencatat empat (catatan/23). Ditemukan pada penyapuan Tugas 8.
const unggah = readFileSync(new URL('../app/(sistem)/po/[id]/panel-unggahan.tsx', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\/|\{\/\*[\s\S]*?\*\/\}/g, '');
assert.doesNotMatch(unggah, /Tiga tanda tangan|ketiganya memang/, 'panel unggahan masih menyebut tiga penanda tangan');
console.log('  OK  panel unggahan tidak menjanjikan tiga tanda tangan');
