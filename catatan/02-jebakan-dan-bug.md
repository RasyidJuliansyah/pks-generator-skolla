# Jebakan dan Bug

Semuanya pernah benar-benar menggigit. Ditulis supaya tidak terulang.

## PostgREST menyemat relasi berkunci unik sebagai OBJEK

`surat_verifikasi` dan `pks` memakai `unique (po_id)`. Akibatnya PostgREST
mengembalikannya sebagai objek tunggal, bukan larik — dan membacanya dengan
`[0]` selalu menghasilkan `undefined`.

Gejalanya menyesatkan: tanda tangan **tersimpan** tapi tidak pernah tampil,
Penerbitan Surat selalu bilang "Belum dibuat", gerbang PKS tidak pernah terbuka.
Pemeriksaan izin basis data lolos semua — karena penulisannya memang tidak
pernah bermasalah; yang rusak pembacaannya. Penawarnya `satu()` di `lib/relasi.ts`.

## `private.punya_peran('x')` bernilai TRUE untuk siapa pun yang Super Admin

Fungsinya memang begitu — barisnya `... or 'admin_utama' = any(private.peran_saya())`.
Untuk memberi wewenang itu benar. Untuk **menahan** wewenang ia terbalik.

`not private.punya_peran('c_level')` terbaca seperti "bukan C Level", padahal artinya
"bukan C Level DAN bukan Super Admin". Penjaga komentar PO yang ditulis begitu akan
mengunci Super Admin dari fitur yang justru terbuka untuknya, dan tidak ada apa pun yang
berbunyi — orangnya cuma menemukan tombolnya tidak bekerja.

Yang benar memeriksa arraynya harfiah: `'c_level' = any (private.peran_saya())`.
Dibuktikan 10 Sep 2026 pada `rasyid@` (admin_utama): `punya_peran('c_level')` = true,
array harfiah = false.

Sisi TypeScript-nya punya jebakan kembar: helper `berperan()` di `lib/supabase-server.ts`
juga meloloskan admin_utama lebih dulu. `bolehKomentar()` karena itu sengaja tidak
memakainya. Keduanya dijaga uji di `uji/peran-baca-saja.test.mjs`.

## `array_length` mengembalikan NULL, dan CHECK meloloskan NULL

`check (array_length(peran, 1) >= 1)` terpasang, migrasinya sukses, dan celahnya
tetap menganga: larik kosong memberi NULL, dan CHECK hanya gagal pada FALSE.
Tertangkap karena penjaganya diuji, bukan diasumsikan bekerja. Ganti
`cardinality()`.

## Email kosong di JWT: perbandingan jadi NULL, dan IF meloloskannya

Kakak dari jebakan di atas, tapi di dalam fungsi `SECURITY DEFINER` — tempat RLS sudah
tidak berlaku, jadi penjaga di fungsi itulah satu-satunya penjaga.

`v_saya := lower(auth.jwt() ->> 'email')` bernilai NULL bila klaim JWT tidak memuat
email. Perbandingan apa pun dengannya ikut NULL, dan IF memperlakukan NULL sebagai
tidak-benar. Akibatnya bentuk yang terbaca paling wajar justru yang terbuka:

- `if lower(pemilik) <> v_saya then raise` — NULL, penolakan dilewati.
- `if not (lower(pemilik) = v_saya or punya_peran(..)) then raise` — `not (NULL or false)`
  tetap NULL, penolakan dilewati.

Pembantu `private.boleh_ubah_po()`, `milik_sales()`, dan `boleh_lihat_po()` punya sifat
yang sama: tanpa email mereka mengembalikan NULL, bukan false. Di kebijakan RLS itu aman
(NULL menolak baris, sama seperti false). Di bawah `if not (...)` hasilnya terbalik.

Penawarnya, untuk setiap fungsi `SECURITY DEFINER` yang memeriksa wewenang:

1. Tolak tegas di baris pertama: `if v_saya is null then raise exception 'Sesi tidak dikenali.'`.
2. Bandingkan dengan `is distinct from`, yang tidak pernah menghasilkan NULL.
3. Bila NULL-nya datang dari fungsi pembantu, bungkus syaratnya: `if not coalesce(..., false)`.

Yang aman tanpa usaha: `not (punya_peran(..) and ..)`. Tanpa email `peran_saya()` = `'{}'`,
`punya_peran()` = false, dan penolakannya jalan.

Riwayat: ditemukan pada `sunting_komentar`/`hapus_komentar` (20260910c), lalu audit semua
fungsi `SECURITY DEFINER` 10 Sep 2026 menemukan dua lagi (20260910e):

- `basikan_verifikasi` sungguh terbuka. Dibuktikan: sesi tanpa email menurunkan keputusan
  berlaku PO #1 dari 4 menjadi 3.
- `ajukan_po_unggahan` melewati pemeriksaan kepemilikannya dan hanya tertahan secara
  kebetulan oleh `tanda_tangan.dibubuhkan_oleh NOT NULL`.

Hari ini hanya masuk Google yang menyala, jadi sesi tanpa email belum bisa diterbitkan.
Jangan jadikan itu jaminan: menyalakan masuk anonim atau telepon di dasbor Supabase
langsung membuka pintunya, dan tidak ada apa pun yang berbunyi.

## `@media (max-width: ...)` ikut berlaku saat mencetak

Lebar halaman A4 hanya 794px, di bawah ambang mana pun. Kertas PKS berubah jadi
tampilan ponsel: isi tidak menjorok, kop cuma di atas, paraf ikut mengalir.
Semua blok layar sempit wajib `@media screen and (...)`.

## Aturan cetak menyembunyikan SEMUA `<header>`

Blok judul PKS kebetulan memakai `<header>`, jadi judul perjanjian hilang dari
setiap hasil cetak — termasuk lewat tombol Cetak yang sudah dipakai.

## `p { max-width: 66ch }` bocor ke dokumen dan panel

Paragraf berakhir ~20mm lebih pendek daripada judul, daftar, dan tabel di
sebelahnya. Terbaca sebagai tepi kanan tidak rata, dan karena paragraf rata kiri
di kotak lebih lebar, judul yang sebenarnya sudah di tengah tampak tidak center.
Dua kali terjadi: di dokumen cetak, lalu di panel dasbor.

## Tinggi kotak persis 297mm bikin halaman kosong tambahan

Pembulatan sepersekian piksel melempar kotak terakhir ke halaman berikutnya.

## Paginasi PKS: tiga cacat yang menghilangkan isi perjanjian

1. Node asli **dipindahkan**, bukan disalin — pengukuran kedua kehilangan satu pasal.
2. Teks pembuka butir hilang karena hanya elemen yang disalin, padahal teks itu
   simpul teks.
3. Marjin milik blok sendiri tidak dihitung sehingga halaman meluber.

Ditambah: daftar termin hidup sebagai **satu butir setinggi 984px** di dalam ayat
Pasal 6, dan pemecah yang hanya membelah butir tingkat atas tak pernah bisa
memecahnya — isinya terpotong tak terlihat.

## Antrean Verifikasi menyaring hanya status berjalan

Keputusan yang sudah diberikan tampak lenyap begitu Tech Ops Lead menutup
tahapnya. Pola yang sama nyaris terulang di Penerbitan Surat dan Perjanjian
(PKS); dicegah dengan daftar status bersama `SETELAH_VERIFIKASI`.

## Status PO tidak ikut berpindah

PKS difinalisasi 12:22, penyambungan status dipasang 12:31. Finalisasi berjalan
dengan kode lama sehingga barisnya tidak pernah diperbarui. Diperbaiki lewat
migrasi yang menyelaraskan status dari keadaan PKS-nya, bukan tambalan tangan.

## Akun nonaktif tetap dianggap sah oleh aplikasi

`private.peran_saya()` menghormati kolom `aktif`, tapi `penggunaSaatIni()` tidak
memeriksanya. Menu muncul, pemeriksaan peran meloloskan, yang terlihat hanya
halaman kosong tanpa penjelasan.

## Warna status gagal kontras

Tujuh dari sebelas gagal ambang 3:1. Emas hanya **1,54:1** di mode terang, biru
tua **1,54:1** di mode gelap. Satu nilai tidak mungkin lolos di kedua tema —
warnanya kini dipisah per tema.

## Fungsi dari berkas `'use client'` dipanggil di server

Mengimpor `rp`/`rpSingkat` dari modul klien ke Server Component memberi rujukan
klien, bukan fungsinya. Gagal **saat berjalan, bukan saat dibangun**.

## Penanda transpiler ikut terserialkan

`Function.prototype.toString` membawa `__name` dari esbuild tanpa definisinya.

## Uji yang lolos karena sebab yang keliru

Uji `buat_pks` pertama memilih akun yang ternyata tanpa peran sales, sehingga
lolos karena penolakan ownership — bukan karena gerbang suratnya. Uji parser
berkas pricelist juga pernah menguji larik kosong dan hijau palsu.

## Lantai harga hanya ditegakkan di server action, tidak di basis data

Ditemukan saat QA 4 Sep 2026, **belum diperbaiki**.

`periksa()` di `lib/po-aksi.ts` menolak harga di bawah bottom price, tapi tidak ada
penjaga apa pun di basis data. Kebijakan RLS `po_buat` mengizinkan pemegang peran
`sales` menyisipkan baris `po` tanpa memeriksa harga sama sekali, jadi Server Action
itu bisa dilewati begitu saja lewat PostgREST.

Dibuktikan, bukan diduga: di dalam transaksi yang dibatalkan, sebuah PO dengan
`harga_siswa = 1000` berikut delapan komponen LMS Juara berhasil masuk — lantainya
seharusnya 186.000.

Ini melanggar prinsip yang dipegang sistem ini sendiri: penjagaan ada di basis data,
bukan di aplikasi. Perbaikannya satu trigger `before insert or update` yang menghitung
ulang lantai dari `po_komponen`. Dua pekerjaan yang direncanakan menambah pintu ke
tabel `po` — kelompok PO dan PO unggahan — membuatnya makin mendesak.

## Pembuat PO bisa memverifikasi PO-nya sendiri

Ditemukan dan diperbaiki 9 Sep 2026.

`verifikasi_putuskan` memeriksa apakah peran pemanggil cocok dengan fungsi verifikasinya,
tapi tidak pernah memeriksa siapa yang membuat PO-nya. Karena `pengguna.peran` bertipe
array, satu orang bisa memegang dua peran — dan memang ada: `farid@` memegang `finance`
sekaligus `sales`, `bintang@` memegang `admin_sales` sekaligus `sales`.

Dibuktikan: farid membuat PO, memajukannya ke verifikasi, lalu memverifikasinya sendiri
sebagai Finance — lolos.

Ditutup trigger `jaga_verifikator_bukan_pembuat`. Ditaruh di trigger, bukan kebijakan
RLS, supaya pesannya menyebut sebabnya. `SECURITY DEFINER` bukan kebiasaan di sini
melainkan syarat: tanpa itu RLS bisa menyembunyikan baris PO, `dibuat_oleh` terbaca
null, dan penjaganya lolos sendiri.

**Akibat operasional yang belum diselesaikan:** `farid@` satu-satunya pemegang `finance`.
Setelah perbaikan ini, PO yang ia buat TIDAK BISA diverifikasi siapa pun di sisi Finance.
Perbaikannya bukan di kode — cabut peran `sales` dari farid, atau tambah pemegang
`finance` kedua.

**Efek samping yang ketahuan 10 Sep 2026:** triggernya dipasang `before insert or update`,
jadi ia juga menolak UPDATE yang hanya MEMBASIKAN keputusan. Sales yang merevisi PO-nya
sendiri yang ditolak tidak bisa menandai persetujuan lama tidak berlaku, dan karena
`simpanDraf` mengabaikan galat RPC-nya, PO dengan isi baru tetap membawa persetujuan atas
isi lama — diam-diam. Ditutup 20260910f: basikan murni dikecualikan, tapi hanya selama
PO berstatus draf/ditolak. Di tahap verifikasi pengecualian itu akan membiarkan farid@
membasikan penolakan verifikator finance lain atas PO buatannya sendiri — membungkam veto.
Sisi aplikasinya ikut diperbaiki: `simpanDraf` kini membasikan sebelum menyimpan induk PO
dan berhenti bila gagal, jadi simpan ulang selalu mencoba membasikan lagi.
