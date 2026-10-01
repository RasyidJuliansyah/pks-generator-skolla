<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Catatan untuk agen

Untuk pekerjaan tampilan, teks, atau tata letak: baca `DESIGN.md` untuk arah
desain, lalu pakai skill antislop sebagai penyaring.

## Menjalankan, menguji, merilis

- Tumpukan: Next.js 16 App Router + TypeScript, `@supabase/ssr`, Supabase `lzamazdfaidxuohhzpjd`.
  Catatan desain dan keputusan ada di `catatan/` (mulai dari `00-peta-sistem.md`).
- Gerbang: `npm run periksa` (tsc + seluruh `uji/*.test.mjs`), lalu `npm run build` (postbuild
  memindai bundel klien untuk harga Acquisition). Mengubah teks dokumen = rekam ulang golden
  `BUAT_EMAS=1 node uji/emas.test.mjs`, periksa selisihnya baris per baris.
- Bukti migrasi tanpa menyentuh produksi: `uji/db-lokal/jalankan-bukti.sh` (Colima + Postgres lokal
  dari dump skema tanpa data).
- Migrasi baru ditulis di `supabase/migrasi/` (KENAPA) dan disalin byte-identik ke
  `supabase/migrations/` (APA yang dijalankan) pada commit yang sama. Diterapkan dengan
  `supabase db push` dari direktori proyek, oleh Rizki.
- Rilis: Vercel TIDAK tersambung git; produksi naik lewat `vercel --prod --yes` dari direktori ini.
- `public/pdf.worker.min.mjs` disalin TANGAN dari `node_modules/pdfjs-dist/build/` dan ikut dikomit
  (dipakai pembacaan scan PO). Naikkan berkas itu setiap kali `pdfjs-dist` diperbarui, lalu uji lagi
  pembacaan scan di peramban: worker yang tidak cocok gagal saat berjalan, bukan saat dibangun.
- ⚠️ `npm install` di mesin ini menjalankan `NODE_ENV=production`, jadi devDependencies
  (typescript, tsx) ikut DIPANGKAS dan `npm run periksa` langsung mati. Pakai `npm install --include=dev`.
- Kerja di cabang `build/<fitur>`, bukan `main`. Push perlu akun gh `rizki-skolla` (repo privat).
- Status terkini ada di `HANDOFF.md` (protokol `~/.agents/handoff-protocol.md`).
