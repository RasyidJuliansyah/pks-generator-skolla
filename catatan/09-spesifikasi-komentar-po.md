# Spesifikasi: Komentar pada PO

Status: **ketiga langkah selesai 10 Sep 2026** — skema dan penjaga; lini masa, kotak
tulis, sunting dengan revisi; penanda baca, lencana, dan daftar di Beranda. Dirancang bersama Rizki 9 Sep 2026, enam keputusannya
divalidasi satu per satu.

## Masalah

Hasil verifikasi bisa berbeda karena percakapan antar peran — "ini kok harganya
begini?", "sudah kamu cek lampirannya?". Percakapan itu hari ini terjadi di WhatsApp
dan japri, sehingga **alasan sebuah keputusan tidak pernah tercatat di PO-nya**.

Yang sudah ada dan tidak boleh diduplikasi: tabel `verifikasi` punya kolom `catatan`,
dan keputusannya berversi (`berlaku`, `digantikan_pada`, `sebab_basi`). Jadi "kenapa
saya memutuskan begini" **sudah** tercatat per fungsi. Yang tidak ada adalah percakapan
dua arah: Sales tidak bisa membalas, dan verifikator tidak bisa berdiskusi satu sama lain.

Komentar mengisi celah itu — bukan menggantikan `verifikasi.catatan`.

## Enam keputusan

| # | Keputusan |
|---|---|
| 1 | **Satu utas terbuka.** Tidak ada bagian yang tersembunyi dari Sales |
| 2 | **Semua yang bisa melihat PO boleh menulis, kecuali C Level** |
| 3 | **Boleh disunting, versi lama tetap tersimpan** |
| 4 | **Lencana dalam aplikasi saja** — tidak ada pemberitahuan keluar |
| 5 | **Menempel ke PO, mencatat `versi_po`** saat ditulis |
| 6 | **Tetap terbuka** setelah verifikasi, dengan garis pemisah keputusan |

### Kenapa satu utas terbuka

Saluran tertutup antar verifikator lebih dekat dengan cara orang benar-benar bekerja,
tapi ia menciptakan pembicaraan tentang pekerjaan seseorang yang tidak bisa ia lihat —
dan keputusan yang dasarnya tidak pernah sampai ke yang dinilai.

Pegangannya: **kalau sesuatu tidak pantas dibaca Sales, ia biasanya juga tidak pantas
jadi dasar keputusan.**

Risiko yang diterima sadar: verifikator jadi lebih hati-hati menulis, dan sebagian
diskusi mungkin tetap pindah ke WhatsApp. Itu lebih baik daripada memindahkannya ke
dalam sistem lalu menyembunyikannya.

### Siapa yang bisa melihat, dan konsekuensinya

`private.boleh_lihat_po()` cuma punya dua tingkat: `boleh_lihat_semua()` atau pemilik.
Dan `boleh_lihat_semua()` mencakup **semua peran kecuali `sales` polos**.

Artinya, dengan satu utas terbuka: Head of Ops, CBO, C Level, keempat fungsi verifikasi,
Tech Ops Lead, Head of Sales, admin_sales, dan Super Admin **membaca semua komentar di
semua PO**. Sales hanya membaca di PO miliknya. Ini konsekuensi yang disengaja, bukan
kelalaian — dan alasan kenapa utasnya tidak boleh jadi tempat menulis hal yang tidak
pantas dibaca luas.

C Level tetap **tidak bisa menulis**. Peran itu sengaja dirancang melihat semuanya dan
menulis nol; kalau ia boleh berkomentar, "read-only" berhenti berarti apa-apa.
`uji/peran-baca-saja.test.mjs` harus diperluas menutup jalur ini.

## Skema

```sql
create table po_komentar (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null references po(id) on delete cascade,
  isi            text not null check (length(btrim(isi)) > 0),
  oleh           text not null,
  waktu          timestamptz not null default now(),
  versi_po       integer not null,        -- salinan po.versi saat ditulis
  disunting_pada timestamptz,
  dihapus_pada   timestamptz              -- ditandai, isinya TIDAK hilang
);

-- Versi lama tidak pernah hilang, sama seperti keputusan verifikasi yang
-- digantikan bukan ditimpa.
create table po_komentar_revisi (
  komentar_id     uuid not null references po_komentar(id) on delete cascade,
  isi             text not null,
  digantikan_pada timestamptz not null default now()
);

-- Penanda baca, untuk lencana.
create table po_komentar_dibaca (
  po_id  uuid not null references po(id) on delete cascade,
  oleh   text not null,
  waktu  timestamptz not null default now(),
  primary key (po_id, oleh)
);
```

`versi_po` disalin dari `po.versi` saat komentar ditulis. Kalau PO sudah berubah sejak
itu, komentarnya diberi penanda **"ditulis sebelum PO diubah"** — supaya "harga termin
kedua kurang" tidak terbaca menyesatkan setelah terminnya diperbaiki. Ini meniru cara
`verifikasi` menjadi basi lewat `versi_po`, bukan mekanisme baru.

## RLS

- **SELECT** — mengikuti `private.boleh_lihat_po(po.dibuat_oleh)` lewat `po_id`.
  Tidak ada aturan visibilitas kedua; komentar tidak boleh jadi jalan memutar untuk
  melihat PO orang lain.
- **INSERT** — visibilitas yang sama, **dan** bukan pemegang `c_level`, **dan**
  `oleh = email pemanggil`. Pemeriksaan c_level HARUS harfiah
  (`'c_level' = any (private.peran_saya())`), bukan lewat `private.punya_peran` —
  lihat [[Jebakan dan Bug]].
- **UPDATE** — hanya komentar sendiri, hanya kolom `isi`, lewat fungsi yang sekaligus
  menyalin isi lama ke `po_komentar_revisi`. Menyunting langsung tidak diizinkan.
- **DELETE** — tidak diizinkan sama sekali. Penghapusan hanya mengisi `dihapus_pada`.

## Lencana dan "bolanya di siapa"

Tidak ada pemberitahuan keluar. Diperiksa 9 Sep 2026: repo ini **tidak punya jalur
keluar sama sekali** — tidak ada e-mail, webhook, atau pesan, dan nol dependensi untuk
itu. Jadi seluruh pemberitahuan hidup di dalam aplikasi.

- Hitungan komentar belum dibaca di daftar PO dan di menu.
- Di beranda: daftar **"PO dengan komentar belum Anda baca"**.
- Di tiap PO: penanda **komentar terakhir ditulis oleh siapa dan perannya**.

Penanda "bolanya di siapa" **diturunkan dari penulis komentar terakhir**, bukan status
yang disetel orang. Ini heuristik, dan harus ditulis begitu di layar — jangan sampai
terbaca sebagai penugasan resmi.

Kelemahan yang diterima sadar: ini hanya bekerja kalau Sales membuka platform tiap hari.
Kalau kelak terbukti pertanyaan sering menggantung, jalan keluarnya menambah e-mail —
keputusan itu sengaja ditunda sampai ada buktinya.

## Layar

Komentar **tidak dibuat sebagai panel terpisah.** `lib/lini-masa.ts` sudah merakit
garis waktu PO dari lima sumber (`po_riwayat`, `tanda_tangan`, `verifikasi`,
`surat_verifikasi`, `pks`). Komentar menjadi **sumber keenam**.

Keuntungannya langsung: "garis pemisah keputusan" yang diminta di keputusan #6 **tidak
perlu dibuat** — keputusan verifikasi dan komentar tersusun berurutan waktu di garis
yang sama, jadi komentar sesudah keputusan otomatis terlihat sesudahnya.

Kotak tulis komentar diletakkan di ujung garis waktu. Komentar yang ditandai dihapus
tetap menempati tempatnya, isinya diganti keterangan siapa menghapus dan kapan.

## Retensi

Komentar adalah teks bebas yang bisa memuat data pribadi — nama, nomor HP, kadang
alasan yang sensitif. Ia bagian dari catatan PO dan **mengikuti umur PO**, bukan aturan
tersendiri. Barisnya perlu ditambahkan ke `catatan/retensi-data-pribadi.md` supaya
register itu tetap utuh.

## Urutan pengerjaan

1. Skema + RLS + uji peran (termasuk C Level tidak bisa menulis, dan komentar tidak
   membocorkan PO orang lain).
2. Komentar sebagai sumber keenam di `lini-masa.ts`, kotak tulis, sunting dengan revisi.
3. Penanda baca + lencana + daftar di beranda.

Langkah 1 tidak mengubah apa pun yang terlihat, jadi bisa naik dan diverifikasi lebih
dulu.

### Langkah 1 — apa yang benar-benar dibuktikan (10 Sep 2026)

Migrasi `20260910_komentar_po.sql`. Serangannya disimulasikan di basis data sungguhan
dengan `set local role authenticated` dan klaim JWT tiap peran, lalu `rollback` — tidak
ada satu baris pun yang tertinggal (diperiksa sesudahnya: 0 komentar, 0 revisi, 0
pengguna uji, 0 PO uji).

13 pemeriksaan lolos: c_level ditolak dengan pesan yang terbaca; `oleh` dan `versi_po`
palsu ditimpa server; Sales lain membaca 0 komentar dan ditolak menulis di PO orang;
Education membaca dan membalas; Super Admin ikut bisa menulis; UPDATE dan DELETE
langsung ditolak 42501; sunting meninggalkan tepat 1 baris revisi berisi teks lama;
bukan penulisnya ditolak menyunting; hapus hanya menandai dan isinya utuh; revisi
tertutup untuk klien dan tidak bocor ke Sales lain.

5 uji mutasi membuktikan penjaganya benar-benar yang menangkap, bukan kebetulan:
mencabut triggernya — kebijakan masih menolak c_level; mencabut kebijakannya — trigger
masih menolak; mencabut trigger sunting — sunting berlalu **tanpa jejak revisi sama
sekali**, lalu jejaknya kembali begitu triggernya dipasang lagi.

Sisi aplikasinya baru `bolehKomentar()` di `lib/supabase-server.ts`; tidak ada layar
yang berubah. `uji/komentar-rls.test.mjs` menjaga bentuk aturannya dari "dirapikan"
kelak — lima mutasi berbeda pada berkas migrasinya dicoba, kelimanya tertangkap.

### Langkah 2 — keputusan kecil yang diambil saat membangun (10 Sep 2026)

- **Kotak tulis di ATAS lini masa.** Lini masanya terbaru di atas, jadi "ujung garis
  waktu" berarti di atas — tempat komentar yang baru ditulis akan muncul.
- **Batas 4.000 karakter, di basis data** (`20260910b`), untuk isi dan revisi. Kira-kira
  dua halaman A4: jauh di atas percakapan wajar, cukup rendah supaya utas tidak dipakai
  menempel dokumen utuh berikut data pribadinya.
- **Komentar yang dihapus tidak memajang versi lamanya.** Kalau tidak, menghapus cuma
  menyembunyikan versi terakhir. Ini soal TAMPILAN — isinya tetap tersimpan, sesuai
  keputusan #3.
- **Titik komentar berbentuk cincin**, bukan bulatan penuh: percakapan, bukan peristiwa.
- **Halaman sekolah tidak menampilkan komentar.** Ia merangkai lini masa per PO lewat
  fungsi yang sama, tapi tidak mengirim `komentar` — percakapan tempatnya di PO-nya.
- **Garis lini masa kini digambar dari butir, bukan dari titik.** Dari titik panjangnya
  tetap ~18px dan tidak sampai ke titik berikutnya begitu butirnya lebih dari dua baris.
  Cacat lama yang baru kentara karena komentar hampir selalu lebih tinggi; ikut
  memperbaiki halaman sekolah.

### Langkah 3 — keputusan yang diambil saat membangun (10 Sep 2026)

- **Peran penulis DISALIN ke komentar** (`nama_penulis`, `peran_penulis`) oleh trigger,
  bukan dibaca dari `pengguna`. Tabel itu tetap tertutup, dan yang relevan memang peran
  orang itu SAAT berbicara — sama seperti `po.sekolah_beku`. Komentar yang ditulis
  sebelum 10 Sep tidak punya salinan ini; tidak ada yang terdampak karena waktu itu
  belum ada satu komentar pun.
- **Lencana menu menempel di Dashboard, bukan Daftar PO.** Daftar di Beranda memuat
  semua PO berkomentar baru; Daftar PO menyembunyikan yang sudah jadi PKS.
- **Ditandai dibaca saat halaman terpasang di peramban**, bukan saat dirender server —
  prefetch tautan ikut merender, dan menandai di sana menghapus lencana PO yang tidak
  pernah dibuka. Hanya dipanggil bila memang ada yang baru.
- **Suntingan tidak menyalakan lencana lagi.** Yang dihitung waktu tulis. Menghitung
  suntingan membuat perbaikan salah ketik ikut menyalakan lencana semua orang.
- **C Level boleh menulis penanda baca.** Itu keadaan tampilan miliknya sendiri, tidak
  terbaca siapa pun dan tidak mengubah PO; tanpanya lencananya tidak pernah hilang.
- **Lencana menu tidak langsung.** Layout tidak dirender ulang saat berpindah halaman;
  angkanya diperbarui aksi server dan muat ulang. Kalau kelak perlu langsung: Realtime.
- **Butir lini masa kini berkunci id komentar**, jadi suntingan yang sedang berjalan
  tidak hilang saat komentar baru muncul di atas (nit QA langkah 2).

Dibuktikan di basis data dengan rollback: salinan penulis tidak bisa dipalsukan dan
tidak bisa diubah; komentar sendiri tidak dihitung; hanya komentar sesudah terakhir
dibaca yang dihitung; komentar dihapus tidak dihitung; Sales lain mendapat nol PO dari
hitungannya dan ditolak membuat penanda baca untuk PO yang tidak terlihat.

### Diketahui, belum diperbaiki (QA langkah 3, tidak menghalangi)

- `tandaiKomentarDibaca` mengabaikan galat RPC-nya. Kalau gagal, lencananya tidak pernah
  hilang dan tidak ada yang tahu. Penawarnya satu baris `console.error`; ditunda ke
  perubahan berikutnya karena setiap perubahan kode sesudah QA berarti QA ulang.
- Dua jendela waktu selebar milidetik: komentar yang transaksinya dimulai sebelum penanda
  baca tapi selesai sesudahnya terhitung sudah dibaca; dan halaman membandingkan waktu
  dalam milidetik sedangkan basis data dalam mikrodetik. Keduanya diterima sadar.

## Uji yang wajib ada

- Pemegang `c_level` **tidak bisa** menyisipkan komentar — ditolak di basis data, bukan
  hanya tombolnya disembunyikan.
- Sales **tidak bisa** membaca komentar pada PO milik Sales lain, termasuk lewat
  PostgREST langsung.
- Menyunting komentar **selalu** meninggalkan baris di `po_komentar_revisi`; isi lama
  tidak pernah hilang.
- `DELETE` pada `po_komentar` ditolak; penghapusan hanya mengisi `dihapus_pada`.
- Komentar yang `versi_po`-nya lebih lama daripada `po.versi` ditandai di layar.
- Garis waktu menampilkan komentar dan keputusan verifikasi dalam urutan waktu yang
  benar, termasuk saat keduanya berdekatan.
