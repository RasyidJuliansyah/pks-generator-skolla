# Spesifikasi: Form PO dengan empat penanda tangan

Status: **TAYANG 25 Sep 2026** (rencana `catatan/24`; lihat "Catatan pembangunan" dan "Rilis" di akhir).

## Tujuan

Kotak tanda tangan Form PO bertambah dari tiga menjadi empat, sesuai informasi baru dari
Rizki (25 Sep 2026). Urutannya:

1. Kepala Sekolah (perwakilan sekolah)
2. Partnership Manager
3. Regional Head Division (baru)
4. Head of Sales (kotak "Sales Manager" yang diganti namanya)

Berlaku untuk PO yang dibuat sistem dan untuk Form PO kertas yang diunggah sebagai scan.

## Keputusan (Rizki, 25 Sep 2026)

| Hal | Keputusan |
|---|---|
| Head of Sales | **Kotak yang sama dengan Sales Manager, diganti nama.** Diisi orang yang sama (akun berperan `head_of_sales`) |
| Regional Head Division | **Peran baru `regional_head`**, dipilih dari daftar akun seperti PM dan Head of Sales |
| PO yang sudah ada | **Hanya PO baru yang butuh empat.** Draf, PO menunggu tanda tangan, dan PO yang sudah diteken tetap tiga, dokumennya tidak berubah |
| Form kertas | **Ikut berubah menjadi empat kotak.** PO unggahan baru juga empat penanda tangan |
| Form kertas lama yang masih beredar | Kotak centang "Form kertas lama (3 kotak)" di jalur unggah (rekomendasi, disetujui bersama rancangan) |
| Akses peran `regional_head` | **Baca-saja seluruh alur**, termasuk harga Acquisition, **dan boleh berkomentar** (keputusan Rizki 25 Sep 2026, sesudah tinjauan). Tanpa wewenang keputusan: tidak menyunting PO, tidak menandatangani, tidak memverifikasi, tidak menerbitkan surat/PKS, tidak menyunting sekolah |
| Pemegang peran | **Zhurry** menjadi Regional Head (melepas `head_of_sales`); Head of Sales tinggal **Agung** |

## Skema tanda tangan per PO

Kolom baru `po.skema_ttd smallint not null`, bernilai 3 atau 4.

- **Diisi trigger saat INSERT**, bukan oleh klien. Bawaannya 4. Satu-satunya jalan ke 3 pada PO
  baru adalah jalur unggah dengan centang form lama (lihat "Unggahan").
- **Backfill**: semua PO yang ada saat migrasi diterapkan menjadi 3. Backfill dijalankan sebelum
  penjaga mengenal kolomnya, pola yang sama dengan `20260830b`.
- **Tidak bisa diubah sesudah lahir**: trigger menolak perubahan `skema_ttd` pada UPDATE dari
  klien, apa pun statusnya. Kolom juga masuk daftar kolom `private.bekukan_isi_po` di **kedua
  tuple** (kolom baru tidak ikut beku sendirinya).
- Fungsi pembantu `private.pihak_wajib(skema smallint) returns pihak_ttd[]` menjadi satu-satunya
  sumber daftar pihak di basis data. Cerminnya di TS: `pihakUntuk(skema)` di `lib/pihak.ts`.

## Pihak

- Enum `pihak_ttd` ditambah `regional_head`, dalam **migrasi terpisah** (nilai enum baru tidak
  bisa dipakai di transaksi yang sama dengan penambahannya).
- Head of Sales **tetap bernilai `sales_manager`** di enum dan di jalur storage
  (`{po}/sales_manager.png`). Hanya labelnya yang berubah. Tidak ada baris `tanda_tangan` atau
  berkas yang dipindah. Presedennya `admin_utama` yang berlabel "Super Admin".
- **Label mengikuti skema.** PO skema 3 tetap tercetak "Sales Manager", supaya dokumen yang sudah
  diteken tidak berubah isi saat dirender ulang. PO skema 4 tercetak "Head of Sales".
  `labelPihak(pihak, skema)` di `lib/pihak.ts`.
- `lib/lini-masa.ts` punya salinan `LABEL_PIHAK` sendiri. Salinan itu dibuang dan diganti
  `labelPihak`, supaya label tidak berpecah.

| Urutan | Skema 3 | Skema 4 |
|---|---|---|
| 1 | `kepala_sekolah` Kepala Sekolah | `kepala_sekolah` Kepala Sekolah |
| 2 | `partnership_manager` Partnership Manager | `partnership_manager` Partnership Manager |
| 3 | `sales_manager` Sales Manager | `regional_head` Regional Head Division |
| 4 | | `sales_manager` Head of Sales |

## Peran `regional_head`

- Enum `peran` ditambah `regional_head` (13 nilai), migrasi terpisah, label "Regional Head
  Division". Diberikan lewat Kelola Pengguna oleh Super Admin.
- **Baca-saja, pola `c_level`** (keputusan Rizki 25 Sep 2026, sesudah terlihat bahwa Zhurry akan
  kehilangan seluruh aksesnya bila peran ini cuma daftar). Disebut HANYA di dua fungsi pembacaan,
  `private.boleh_lihat_semua` dan `private.boleh_lihat_acquisition`. Tidak di jalur tulis mana
  pun; tiap jalur tulis menyebut perannya eksplisit, jadi tidak perlu daftar larangan.
  **Komentar berbeda, dan itu disengaja**: jalur komentar meloloskan siapa pun yang boleh melihat
  PO lalu menolak C Level secara harfiah. Karena `regional_head` masuk `boleh_lihat_semua`, ia
  otomatis boleh berkomentar, dan Rizki memutuskan (25 Sep 2026) memang begitu yang dikehendaki.
  Peran baca-saja baru yang TIDAK boleh berkomentar harus ditambahkan ke keempat penjaga komentar
  (policy `komentar_tulis`, `jaga_komentar_baru`, `sunting_komentar`, `hapus_komentar`).
- **Ikut melihat harga Acquisition**, sama seperti C Level. Disengaja; cara mencabutnya satu kata
  (hapus dari `boleh_lihat_acquisition`) ditulis di migrasinya.
- `pengguna` dan `pengguna_riwayat` tetap tertutup, milik Super Admin.
- Tanda tangan tetap dibubuhkan di perangkat Sales seperti hari ini; Regional Head tidak perlu
  masuk untuk menandatangani.
- Dijaga `uji/peran-baca-saja.test.mjs`, diperluas dengan `regional_head`: melihat semua PO,
  gagal di setiap jalur tulis.

## Data PO

Kolom baru `po.nama_rh text`, pasangan `nama_pm` dan `nama_sm`.

- Masuk daftar kolom `private.bekukan_isi_po` (kedua tuple).
- Wajib terisi untuk keluar dari draf pada PO skema 4: syaratnya ditambahkan di trigger yang
  sudah menjaga keluar draf (`po_syarat_maju`) dan di `periksa()` `lib/po-aksi.ts`, dengan pesan
  yang sama.
- Pada PO skema 3 kolom ini diabaikan dan tidak ditampilkan.

## Perpindahan status

Trigger urutan status (`20260917d_urutan_status_po`, yang terbaru di rantai) memeriksa
`count(distinct pihak) >= 3` di dua tempat. Keduanya diganti menjadi: semua pihak di
`private.pihak_wajib(skema_ttd)` sudah ada barisnya. Pesannya menyebut jumlah yang benar
("% dari 4").

Sisi aplikasi yang ikut:

- `panel-ttd.tsx`: kotak dan syarat "lengkap" dari `pihakUntuk(po.skema_ttd)`.
- `lib/po-aksi.ts`: penghapusan berkas tanda tangan (baris `URUT_PIHAK.map(...)`) memakai daftar
  empat pihak untuk semua PO. Menghapus jalur yang tidak ada tidak galat, dan PO skema 3 tidak
  punya berkas `regional_head`.

## Dokumen

- **Form PO halaman 2** (`lib/dokumen-po.ts`): tabel `po-ttd` merender kolom sesuai skema. Empat
  kolom di lebar A4 diukur di pratinjau, tidak dibayangkan: nama panjang harus membungkus, tidak
  meluber.
- **Surat Verifikasi dan PKS** tidak memuat kotak tanda tangan PO; tidak berubah. Dipastikan
  lewat golden yang tetap identik.
- Golden yang ada **tidak boleh berubah** (semuanya PO skema 3). Golden baru untuk PO skema 4.
  Regenerasi `BUAT_EMAS=1 node uji/emas.test.mjs`, lalu selisihnya diperiksa baris per baris:
  selisih pada golden lama berarti label skema 3 bocor.

## Wizard

Langkah Penanda tangan & catatan (`langkah/penanda.tsx`): dropdown ketiga "Regional Head
Division" dari `daftarPengguna(['regional_head'])`, di antara PM dan Head of Sales. Label
dropdown SM menjadi "Head of Sales". Pada draf skema 3 yang dibuka lagi, dropdown RH tidak
tampil dan labelnya tetap "Sales Manager".

Bila belum ada satu pun akun berperan `regional_head`, dropdown kosong dan halangan simpan
menjelaskan bahwa Super Admin perlu memberikan peran itu lebih dulu. Tidak ada isian bebas.

## Unggahan

- `ajukan_po_unggahan()` menyisipkan baris `tanda_tangan` penanda (asal unggahan) untuk setiap
  pihak di `pihak_wajib(skema_ttd)`, termasuk `regional_head` dari `nama_rh` pada skema 4.
  Fungsi terbaru di rantai adalah versi `20260911b_sidik`; perubahan ditulis di atasnya, sidik
  tetap utuh.
- **Form kertas lama.** Langkah 0 jalur unggah punya kotak centang "Form kertas lama (3 kotak)".
  Dicentang: PO lahir dengan skema 3. Nilainya dikirim saat draf pertama disimpan dan dibaca
  trigger INSERT hanya bila `asal = 'unggahan'`; PO platform selalu 4. Sesudah lahir tidak bisa
  diubah, sama seperti jalurnya sendiri yang dibekukan.
- **Ekstraksi (`catatan/17`)**: Regional Head tetap dipilih dari daftar akun, tidak dibaca dari
  scan, sama seperti PM dan Head of Sales. `catatan/17` diamandemen satu baris.

## Uji

1. **Bukti basis data dalam transaksi yang dibatalkan:**
   - PO lama (skema 3) maju ke `ditandatangani` dengan tiga tanda tangan;
   - PO baru ditolak di 3 dari 4 dan lolos di 4 dari 4;
   - Sales tidak bisa mengubah `skema_ttd` lewat PostgREST, baik ke 3 maupun ke 4;
   - PO platform tidak bisa lahir dengan skema 3;
   - `nama_rh` kosong menahan PO skema 4 keluar draf;
   - `nama_rh` dan `skema_ttd` beku pada PO yang sudah diteken;
   - `ajukan_po_unggahan` menyisipkan empat penanda pada skema 4 dan tiga pada skema 3;
   - akun yang hanya berperan `regional_head` melihat semua PO dan harga Acquisition, dan ditolak
     di setiap jalur tulis (sunting PO, tanda tangan, verifikasi, surat, PKS, sekolah).
2. **Uji murni**: `pihakUntuk`, `labelPihak`, dan kesetaraan daftar pihak TS dengan
   `private.pihak_wajib` (penjaga dengan `migrasiTerakhir`, bukan nama berkas yang dipatok).
3. **Golden**: lama identik, baru untuk skema 4.
4. **Pratinjau**: panel tanda tangan dan halaman 2 Form PO, empat kolom, dua tema, lebar 1200
   dan 375, diukur (`scrollWidth`/`clientWidth`).
5. **Penyaring**: `npm run periksa`, `npm run build`, lalu QA independen sebelum migrasi
   diterapkan ke produksi dan sebelum deploy.

## Urutan penerapan

Migrasi dan kode harus tayang berdekatan: begitu migrasi diterapkan, PO baru yang dibuat dari
aplikasi lama akan lahir skema 4 tanpa dropdown RH dan tertahan di draf. Karena itu migrasi
diterapkan lewat `supabase db push` tepat sebelum `vercel --prod`, bukan berhari-hari
mendahului kode.

## Sebelum tayang

- **Peran Zhurry** (`zhurry@skolla.education`) diubah dari `{head_of_sales}` menjadi
  `{regional_head}`, **sesudah** migrasi tayang (nilai enumnya belum ada sebelum itu), lewat
  Kelola Pengguna oleh Super Admin supaya `pengguna_riwayat` mencatat pelakunya. Agung tetap
  satu-satunya `head_of_sales`. Dicek 25 Sep 2026: Zhurry tidak membuat PO, tidak memegang
  sekolah, dan satu-satunya PO yang ia teken sebagai Sales Manager sudah diteken (skema 3, tetap
  tercetak "Sales Manager"). Tanpa satu pun `regional_head`, PO baru tidak bisa keluar draf.
- Form kertas empat kotak disiapkan tim di luar sistem.

## Di luar lingkup

- Regional Head yang ditentukan otomatis dari wilayah sekolah.
- Mengubah PO lama ke empat penanda tangan.

## Catatan pembangunan (25 Sep 2026)

Dibangun inline (Rizki memilih eksekusi native), 12 commit di `build/ekstraksi-scan-po`, lalu satu
tinjauan independen seluruh cabang.

**Migrasi**: dua, belum diterapkan ke produksi. `20260925_empat_penanda_enum` (nilai enum) dan
`20260925b_empat_penanda_tangan` (skema per PO, pihak wajib, peran baca-saja). Dibuktikan di Postgres lokal berisi skema produksi tanpa
data: `uji/db-lokal/jalankan-bukti.sh`, probe P1-P12 semua OK.

**Tambahan di luar spesifikasi, ditemukan saat membangun:**
- Sidik tinjauan PO unggahan adalah hash seluruh baris, jadi kolom baru akan membasikan setiap
  draf unggahan yang sudah ditinjau. Kolom baru dikeluarkan dari sidik selama kosong; P9 membuktikan
  sidik draf lama tidak berubah (diuji mutasi).
- Nama panjang di empat kolom membungkus dan mengangkat garis tanda tangannya; sel empat kolom
  dirapatkan ke atas supaya keempat garis sejajar (terukur).
- Teks panel unggahan menjanjikan "tiga tanda tangan"; diganti.

**Tinjauan independen: FAIL, empat temuan Important, semuanya diperbaiki dengan uji merah-hijau:**
1. Regional Head bisa menulis komentar. Sempat ditutup lewat migrasi `20260925c`; Rizki lalu
   memutuskan Regional Head MEMANG boleh berkomentar, jadi migrasi itu dibuang sebelum pernah
   diterapkan. P11 kini membuktikan Regional Head bisa berkomentar dan C Level tetap ditolak.
2. PO unggahan skema 3 bisa dibalik jadi platform selagi draf lewat PostgREST, lalu mengumpulkan
   tiga tanda tangan di aplikasi. `jaga_syarat_maju` kini membekukan `asal` pada skema 3 (P12).
3. Lini masa di halaman sekolah menulis Head of Sales sebagai Sales Manager; kini membaca skema,
   dan penjaga memastikan setiap pemanggil `liniMasa` mengopernya.
4. Probe P8 tidak mencakup verifikasi, surat, PKS, sekolah; ditambah P8b.

**Terukur**: Form PO halaman 2 empat kotak di 794px tanpa luber, sel 170/170; panel tanda tangan
dan langkah Penanda di 375 dan 1200, dua tema, `scrollWidth = clientWidth`. Golden PO lama
byte-identik.

## Rilis (25 Sep 2026)

- Migrasi `20260925010000` dan `20260925020000` diterapkan Rizki sendiri lewat `supabase db push`
  (pengklasifikasi izin agen menolak menjalankannya). Riwayat 71 dari 71 cocok.
- Diperiksa di produksi sesudahnya: tiga PO yang ada semuanya `skema_ttd = 3`, bawaan kolom 4,
  enum `pihak_ttd` berurutan kepala_sekolah, partnership_manager, regional_head, sales_manager,
  `boleh_lihat_semua` memuat `regional_head`.
- `vercel --prod`: pindai bundel bersih; `/beranda` 307, `/masuk` 200, `/po/baru` 307, rute PDF 401.
- Menunggu: Rizki memindahkan Zhurry dari Head of Sales ke Regional Head Division di Kelola
  Pengguna. Sampai itu terjadi, PO baru tidak bisa keluar draf (belum ada akun Regional Head).

