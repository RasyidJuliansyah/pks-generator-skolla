# Plan Migrasi: `pks-generator` ke MySQL & Prisma Stack (Skolla Production Ready)

Dokumen acuan migrasi sistem dari PostgreSQL (Supabase) ke MySQL murni + Prisma ORM + JWT Auth, diselaraskan dengan standar deployment server produksi `skolla.education` (seperti `okr-dashboard2`).

---

## Target Arsitektur Akhir
* **Framework**: Next.js 16 (App Router, Server Actions, Standalone Output).
* **Basis Data**: MySQL 8.x (Port 3307 lokal, managed MySQL di server produksi).
* **ORM**: Prisma Client (`@prisma/client`).
* **Autentikasi**: JWT HttpOnly Cookie + Bcrypt Password (Internal `@skolla.education`).
* **Penyimpanan Berkas**: Local Persistent Volume (`/app/uploads`) via Next.js Route Handler.
* **Deployment**: Docker Compose di server Linux (`/mnt/vdb/...`).

---

## Tahapan Migrasi

### Tahap 1: Persiapan Dependensi & Fondasi Prisma
- [x] Pasang dependensi: `@prisma/client`, `bcrypt`, `jsonwebtoken`, `prisma`, `@types/bcrypt`, `@types/jsonwebtoken`.
- [x] Tambahkan kolom `password VARCHAR(255)` ke tabel `pengguna` di MySQL dan model `Pengguna` di `prisma/schema.prisma`.
- [x] Buat singleton client database di `lib/prisma.ts`.
- [x] Generate Prisma Client (`npx prisma generate`).

### Tahap 2: Autentikasi Mandiri (JWT + Bcrypt)
- [x] Buat helper autentikasi di `lib/auth.ts` (hash password, verifikasi password, buat token JWT, verifikasi token).
- [x] Buat Server Actions login & logout di `lib/auth-aksi.ts`.
- [x] Perbarui `middleware.ts` untuk memverifikasi cookie sesi JWT internal tanpa request keluar.
- [x] Ganti `lib/supabase-server.ts` dengan `lib/sesi.ts` (`penggunaSaatIni()` dan `penggunaHalaman()` berbasis Prisma & JWT).
- [x] Sesuaikan halaman form masuk di `app/masuk/page.tsx` (email + password form).

### Tahap 3: Penyimpanan Berkas Persisten (Storage Lokal / Volume Mount)
- [x] Buat helper penyimpanan berkas di `lib/storage.ts` (simpan, baca, dan hapus berkas fisik pada folder `uploads`).
- [x] Buat Route Handler `app/api/berkas/[...path]/route.ts` untuk melayani berkas (PDF PO, tanda tangan, pks basah) dengan proteksi sesi.
- [x] Ganti fungsi upload Supabase Storage di form PO dan PKS dengan penyimpanan berkas lokal.

### Tahap 4: Refactor Lapisan Kueri Data (Supabase → Prisma)
- [x] Refactor master data pengguna & riwayat di `lib/pengguna-aksi.ts` dan `app/(sistem)/pengguna/page.tsx`.
- [x] Refactor kueri agregasi `hitung_po_per_status` dan daftar PO di `lib/po-kueri.ts` & `app/(sistem)/po/page.tsx`.
- [x] Refactor kueri antrean dan arsip PKS di `lib/pks-kueri.ts` & `app/(sistem)/pks/page.tsx`.
- [x] Refactor komentar & revisi diskusi PO di `lib/komentar.ts`.
- [x] Refactor retensi audit di `lib/retensi.ts`.
- [x] Refactor sisa transaksi mutasi PO dan entitas anaknya di `lib/po-aksi.ts`.
- [x] Refactor verifikasi multi-divisi dan tanda tangan di `lib/surat-aksi.ts` & `lib/verifikasi-kueri.ts`.
- [x] Refactor penerbitan nomor PKS dan dokumen sponsorship di `lib/pks-aksi.ts`.
- [x] Refactor halaman detail PO, surat, PKS, sekolah, beranda, analitik (`lib/po-detail.ts`, `lib/surat-kueri.ts`, `lib/sekolah-kueri.ts`, `lib/beranda-kueri.ts`, `lib/analitik-kueri.ts`).

### Tahap 5: Ekstraksi AI Scan Dokumen & Konfigurasi
- [x] Sesuaikan gerbang ekstraksi AI dengan Prisma di `lib/ekstraksi-gerbang-aksi.ts`.
- [x] Validasi form PO baru dengan `gerbangEkstraksiMenyala()`.
- [x] Integrasi model `EkstraksiPo` dan `PengaturanEkstraksi` di `prisma/schema.prisma`.

### Tahap 6: Dockerisasi & SOP Deployment Produksi Skolla
- [x] Konfigurasi `output: 'standalone'` pada `next.config.mjs`.
- [x] Buat `Dockerfile` multi-stage untuk container Next.js dengan dukungan Chromium & volume storage.
- [x] Buat `docker-compose.yml` dengan stack MySQL 8 + Next.js standalone + persistent uploads volume.
- [x] Tulis dokumentasi deployment di `DEPLOYMENT.md`.

### Tahap 7: Pembersihan Dependensi Supabase & Verifikasi
- [x] Hapus pemanggilan Supabase server dari semua route dan aksi aplikasi.
- [x] Jalankan `npm run periksa` (44 test suites pass).
- [x] Jalankan `npm run build` (lulus build produksi Next.js & pindai bundel).
