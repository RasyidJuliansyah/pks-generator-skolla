// Mencari migrasi TERAKHIR yang mendefinisikan sesuatu — bukan nama berkas yang dipatok.
//
// Uji yang membaca `supabase/migrasi/20260917b_verdict_iom.sql` secara harfiah tetap hijau
// setelah fungsi yang sama ditulis ulang di migrasi yang lebih baru: berkas lamanya tidak
// berubah, jadi asersinya masih cocok, sementara yang benar-benar terpasang di basis data
// sudah lain. Itu bukan penjaga, itu jimat.
//
// Sudah terjadi tiga kali dalam satu hari (20 Sep 2026): jaga_syarat_maju, bekukan_isi_po,
// dan nilai_iom semuanya ditulis ulang oleh 20260920a/b. Jadi jangan mematok nama berkas —
// tanyakan "siapa yang terakhir mendefinisikan ini".
import { readFileSync, readdirSync } from 'node:fs';

const DIR = new URL('../supabase/migrasi/', import.meta.url);

/** Semua berkas migrasi, urut nama — urutan nama = urutan penerapan di proyek ini. */
export function berkasMigrasi() {
  return readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();
}

/**
 * Isi migrasi TERAKHIR yang cocok `pola`, plus namanya.
 * `migrasiTerakhir(/function private\.nilai_iom/)` -> { nama, isi }
 */
export function migrasiTerakhir(pola) {
  const cocok = berkasMigrasi().filter((f) => pola.test(readFileSync(new URL(f, DIR), 'utf8')));
  if (!cocok.length) throw new Error(`tidak ada migrasi yang cocok ${pola}`);
  const nama = cocok[cocok.length - 1];
  return { nama, isi: readFileSync(new URL(nama, DIR), 'utf8') };
}
