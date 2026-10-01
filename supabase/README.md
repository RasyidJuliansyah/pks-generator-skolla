# Basis data

Proyek produksi: `lzamazdfaidxuohhzpjd` (org Skolla Education, region ap-southeast-1).

## Riwayat migrasi: SUDAH ditarik (21 Sep 2026)

`supabase/migrations/` berisi **68 migrasi** — seluruh riwayat proyek, dari
`20260829022435_pengguna_dan_peran` sampai `20260922030000_lolos_langsung_pks`.
Basis data ini sekarang bisa dibangun ulang dari nol, dan `supabase db push`
tidak lagi terhalang.

Angka 60 adalah keadaan saat penarikan 21 Sep 2026; sesudahnya rantai bertambah
tujuh berkas, dan ujungnya dua kali berlubang lagi lalu ditutup (lihat di bawah).

### Cara menariknya, dan kenapa BUKAN `db pull`

Sampai 21 Sep 2026 seluruh riwayat cuma ada di proyek awan: migrasi diterapkan
langsung ke produksi selama pengembangan. `supabase db push` menolak jalan
dengan `LegacyDbPushMissingLocalError`, dan CLI menyarankan
`migration repair --status reverted` atas 59 versi — perintah yang **MENGHAPUS**
baris riwayatnya. Saran itu ditolak dua kali, dan itu keputusan yang benar.

Sebabnya baru ketahuan setelah tabelnya dicadangkan dan dibaca:
**kolom `statements` ternyata memuat SQL asli setiap migrasi.** Menjalankan
saran CLI akan memusnahkan satu-satunya rekaman cara basis data ini dibangun —
persis hal yang paling dibutuhkan repo ini.

Jadi yang dilakukan bukan `db pull` (yang cuma menghasilkan satu berkas
snapshot dan menimpa riwayat), melainkan:

1. `supabase db dump --linked --data-only -s supabase_migrations` — cadangan
   sekaligus bahan baku.
2. Cadangan itu dimuat ke Postgres sementara di Docker, lalu tiap baris
   diekspor jadi `<versi>_<nama>.sql` lewat SQL — bukan diurai tangan, supaya
   kutip dan dollar-quoting di badan fungsi tidak rusak.
3. `supabase migration list` -> **59 dari 59 cocok, nol yatim.**
   `supabase db push --dry-run` -> `upToDate: true`.

**Nol penulisan ke produksi.** Tidak ada baris yang dihapus, tidak ada SQL yang
dijalankan ulang.

### Lubang di ujung rantai — DUA kali, keduanya sudah ditutup

**Putaran pertama (21 Sep 2026).** Migrasi
`20260921000000_balasan_komentar.sql` diterapkan ke produksi lewat
Management API, dan jalur itu **tidak menulis baris riwayat**. Rantainya sempat
berlubang di ujung: berkasnya ada di repo, riwayat awan berhenti di 17 Sep.

Ditutup dengan `supabase migration repair --status applied 20260921000000` —
menyisipkan satu baris, tidak menjalankan SQL apa pun. Isinya sudah diverifikasi
sama dengan yang hidup (`induk_kunci`, `kedalaman`, dan penjagaan `20260910d`
semuanya ada di dump skema produksi hari itu).

**Putaran kedua (22 Sep 2026).** Dua migrasi terakhir,
`20260922_kelompok_otomatis.sql` dan `20260922b_hoo_penutup_pembuat.sql`, hanya
masuk ke `supabase/migrasi/` (catatan KENAPA) dan tidak pernah disalin ke rantai.
Keduanya diterapkan lewat Management API, jadi riwayat awan berhenti di
`20260921120000`.

Kenapa ini berbahaya justru karena **tidak kelihatan**: `migration list`
melaporkan jumlah lokal = jumlah awan, dan `db push --dry-run` menjawab
`upToDate: true`. Tidak ada galat apa pun — yang terjadi cuma rebuild dari nol
diam-diam kehilangan kedua aturan itu.

Ditutup dengan menyalin keduanya apa adanya ke rantai sebagai
`20260922010000_kelompok_otomatis.sql` dan `20260922020000_hoo_penutup_pembuat.sql`
(salinan byte-identik, pola yang sama dengan pasangan sebelumnya), lalu
`migration repair --status applied` atas kedua versi itu.

Bukti bahwa keduanya memang sudah hidup di produksi: kolom
`verifikasi_otomatis.kelompok` ada di skema produksi lewat
`supabase gen types typescript --linked`. Badan fungsi
`tutup_verifikasi_otomatis` tidak muncul di introspeksi itu, jadi untuk berkas
kedua yang dipakai adalah catatan penerapan di pesan commit 22 Sep.

Keadaan sekarang: **68 lokal, 67 di antaranya sudah di awan, satu menunggu diterapkan**
(`20260922030000_lolos_langsung_pks`), jadi `db push --dry-run` TIDAK lagi menjawab
`upToDate: true`. Itu disengaja: migrasi yang mengubah perilaku penutupan verifikasi tidak
diterapkan ke produksi tanpa persetujuan lebih dulu.

### 22 Sep 2026 — pasangan ketiga, dan penjaganya sudah ada

`20260922c_lolos_langsung_pks.sql` (catatan KENAPA) disalin byte-identik ke rantai sebagai
`20260922030000_lolos_langsung_pks.sql` pada commit yang sama, mengikuti aturan di bawah.

**Penjaga otomatisnya kini ADA.** `uji/rantai-migrasi.test.mjs` membandingkan isi kedua
folder untuk setiap migrasi sejak `20260921`, jadi lubang ketiga ketahuan begitu uji
dijalankan — bukan cuma kalau ada yang ingat memeriksanya. Catatan di bawah yang menyatakan
penjaganya belum ada sudah tidak berlaku.

Aturan disiplinnya tetap: setiap migrasi baru ditulis di `supabase/migrasi/`
**dan** disalin apa adanya ke `supabase/migrations/` pada commit yang sama.

⚠️ **Pelajaran yang berlaku seterusnya: Management API menerapkan SQL TANPA
mencatat riwayat.** Kalau terpaksa memakainya lagi, catat sendiri sesudahnya
dengan `migration repair --status applied <versi>`, atau rantainya berlubang
lagi dan rebuild dari nol diam-diam kehilangan perubahan itu.

### `supabase/migrasi/` tetap ada, dan tetap berguna

38 berkas di sana BUKAN kembaran yang bisa dihapus. Isinya catatan tulisan
tangan berikut ALASAN tiap penjagaan — kenapa sebuah fungsi `security invoker`
dan bukan `definer`, kenapa `c_level` diperiksa harfiah, jebakan apa yang pernah
menggigit. Rantai di `supabase/migrations/` menyimpan APA yang dijalankan;
`supabase/migrasi/` menyimpan KENAPA. Uji `uji/migrasi.mjs` membaca yang kedua.

## Sesudah itu: mengembangkan tanpa menyentuh produksi

### Pilihan 1 — basis data lokal: DICOBA, LALU DITINGGALKAN

Colima dan tumpukan Supabase lokal sempat disiapkan dan berjalan di MacBook
Rizki pada 2026-08-30, lalu sengaja dimatikan lagi. Dicatat di sini supaya tidak
ada yang mengulang jalan yang sudah ditempuh.

Yang membuatnya tidak dipilih: **aplikasi ini cuma punya satu jalur masuk, dan
jalur itu Google OAuth yang menunjuk ke proyek awan.** Supabase lokal tidak
punya penyedia Google sama sekali, jadi basis data lokalnya bisa disunting lewat
Studio tapi aplikasinya sendiri mentok di halaman masuk. Menembusnya berarti
menambah jalur masuk khusus pengembangan — dan jalur itu, sebaik apa pun
dipagari, adalah kode pintu belakang yang ikut terkirim ke produksi.

Catatan yang tetap berguna kalau suatu saat dihidupkan lagi:

- `supabase start -x realtime,imgproxy,edge-runtime,logflare,vector,supavisor` —
  keenam layanan itu tidak dipakai sistem ini dan citranya beberapa gigabita.
- **Satu tumpukan saja yang boleh jalan.** Port 54321-54324 dipakai bersama
  semua proyek Supabase lokal di mesin yang sama, dan container proyek lama
  menyala sendiri tiap Colima start. Kalau "port is already allocated":
  `supabase stop --project-id <nama-proyek-lain>`.
- Menyetel env lewat variabel shell (`NEXT_PUBLIC_SUPABASE_URL=… next dev`)
  lebih aman daripada menukar `.env.local`, yang gampang rusak.

### Pilihan 2 — branch basis data (perlu paket Pro)

Supabase bisa membuat cabang basis data berumur pendek dari produksi, lengkap
dengan skemanya, dan Vercel preview deployment bisa menunjuk ke sana. Ini yang
paling mendekati produksi. Belum tersedia selama org masih di paket gratis.

### Pilihan 3 — proyek Supabase kedua sebagai dev (DIPILIH, TERGANJAL PAKET)

Keputusan Rizki 2026-08-30. Bentuknya **satu proyek Vercel, dua proyek
Supabase** — bukan dua-duanya digandakan:

| Lingkungan Vercel | Cabang | Menunjuk ke |
|---|---|---|
| Production | `main` | Supabase produksi |
| Preview | cabang lain, otomatis | Supabase dev |

Env di Vercel disetel per lingkungan, jadi tiap cabang git dapat URL pratinjau
sendiri yang bicara ke basis data dev. Menggandakan proyek Vercel hanya
menggandakan domain, tim, integrasi git, dan riwayat deploy tanpa gunanya.

Nilai terbesarnya: **jalur masuk khusus pengembangan jadi tidak perlu ada.**
Proyek dev punya Google OAuth sungguhan, jadi tidak ada kode pintu belakang yang
ikut terkirim ke produksi.

**Terganjal:** pembuatannya ditolak — paket gratis membatasi **dua proyek aktif
per admin**, dan keduanya sudah terpakai `skolla-kerjasama` dan
`skolla-team-dashboard`. Jalan keluarnya menaikkan org ke Pro, atau menidurkan
salah satu proyek aktif (bukan pilihan: keduanya dipakai).

Yang perlu disiapkan tangan setelah proyeknya ada:

1. Redirect URI `https://<ref-dev>.supabase.co/auth/v1/callback` didaftarkan di
   Google Cloud Console, dan daftar redirect yang diizinkan di Supabase dev
   memuat pola domain pratinjau Vercel — URL pratinjau berubah tiap deploy.
2. Disiplin migrasi: skema diubah di dev lewat `supabase db push`, lalu
   perubahan yang sama didorong ke produksi. Tanpa itu keduanya menyimpang
   dalam sebulan dan dev berhenti bisa dipercaya.

## Aturan yang tidak berubah

Perubahan skema apa pun **wajib diuji lebih dulu di dalam transaksi yang
dibatalkan**, dengan simulasi peran, sebelum diterapkan:

```sql
begin;
  -- perubahannya
  set local role authenticated;
  set local request.jwt.claims = '{"email":"orang@skolla.education","role":"authenticated"}';
  -- buktikan yang dilarang ditolak DAN yang sah tetap jalan
rollback;
```

Setiap migrasi keamanan di `supabase/migrasi/` disusun begitu, dan pola itulah
yang menemukan lima lubang pada 2026-08-30. Menguji hanya sisi "boleh" tidak
pernah menemukan apa pun.
