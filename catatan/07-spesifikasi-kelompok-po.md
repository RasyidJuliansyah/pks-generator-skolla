# Spesifikasi: Kelompok dalam satu PO

Status: **langkah 1 selesai 10 Sep 2026** (kolom kelompok, dikunci ke 1; uji emas).
**Langkah 3 selesai 12 Sep 2026, dipersempit** ke fungsi hitung murni. **Langkah 4–6 tayang
12 Sep 2026 sebagai satu rilis** (`5ce9011`, deploy `gsgmiwthg`; lihat "Rilis kelompok" di bawah). Arahnya disetujui Rizki 4 Sep 2026; empat hal yang sempat terbuka
divalidasi 9 Sep 2026 dan sudah dijalin ke dalam dokumen ini.
Ditulis lebih dulu karena perubahan ini menyentuh dokumen yang ditandatangani
sekolah dan lantai harga yang ditegakkan server — dua tempat yang paling mahal
kalau salah.

## Masalah

Satu PO hari ini punya SATU `jumlah_siswa` dan SATU `harga_siswa`. Semua komponen
dianggap dipakai oleh seluruh siswa. Kenyataannya tidak.

Contoh nyata (SMA Santamaria Monica, 300 siswa, LMS Juara):

| Komponen | Pemakai sebenarnya |
|---|---|
| LMS dan turunannya | 300 |
| Asesmen Psikolog | 200 (kelas 10 & 12) |
| Tryout TKA/SNBT | 100 (kelas 12) |

Sistem menagih `350.000 × 300 = Rp105.000.000` — seolah 300 siswa memakai Tryout
dan Asesmen. Sekolah membayar pemakai yang tidak ada, dan Sales tidak punya cara
menuliskannya dengan benar.

## Kenapa "jumlah pemakai per komponen" DITOLAK

Cara paling lurus adalah menambahkan `jumlah_siswa` ke `po_komponen`. Sudah
dihitung, dan ia menyimpan jebakan yang tidak kelihatan sampai diangkakan:

| Model | Harga | Lantai |
|---|---|---|
| A. Sekarang, satu jumlah untuk semua | 105.000.000 | 55.800.000 |
| B. Jumlah pemakai per komponen | 89.500.000 | **59.700.000** |
| C. Per kelompok kelas | 90.500.000 | 55.400.000 |

**Model B menaikkan lantai 3,9 juta.** Begitu tiap komponen dihitung sendiri-sendiri,
diskon bundel paket hilang seluruhnya — jadi B menurunkan harga jual sekaligus
mempersempit ruang tawar Sales. Model C memberi harga jujur tanpa mengambil ruang itu.

Alasan kedua menolak B: angka yang diketik lepas bisa bertentangan dengan
`po_rombel` tanpa ada yang menangkap, dan "100 siswa" tidak menyebut **100 yang mana**
— sekolah maupun verifikator tidak bisa mengeceknya.

## Model C: satu PO, beberapa kelompok

Contoh di atas terurai rapi per angkatan:

| Kelompok | Siswa | Isi | Harga |
|---|---|---|---|
| Kelas 10 | 100 | LMS + Asesmen | 315.000 · a la carte |
| Kelas 11 | 100 | LMS saja | 240.000 · a la carte |
| Kelas 12 | 100 | LMS + Asesmen + Tryout | 350.000 · **paket LMS Juara** |

Kelas 12 memakai paket lengkap sehingga tetap mendapat harga paket berikut diskon
bundelnya. Kelompok lain dihargai sesuai isinya. Tidak ada siswa hantu.

**PO yang ada sekarang adalah PO dengan tepat satu kelompok.** Ini perluasan, bukan
penulisan ulang.

> **Koreksi angka, 12 Sep 2026.** Angka contoh di atas dihitung dengan harga komponen
> SEBELUM pricelist 4.0 dan tidak bisa direproduksi lagi. Model A masih tepat
> (Rp105.000.000, lantai Rp55.800.000). Model C dengan pricelist 4.0 — "LMS dan
> turunannya" dibaca sebagai LMS Smart, satu-satunya tafsir yang cocok dengan angka
> Rp240.000 untuk Kelas 11:
>
> | Kelompok | Siswa | Isi | Harga | Lantai |
> |---|---|---|---|---|
> | Kelas 10 | 100 | LMS Smart + Asesmen | 279.000 · a la carte | 185.000 |
> | Kelas 11 | 100 | LMS Smart | 240.000 · **paket LMS Smart** | 135.000 |
> | Kelas 12 | 100 | LMS Juara | 350.000 · **paket LMS Juara** | 186.000 |
>
> Total **Rp86.900.000, lantai Rp50.600.000**. Kesimpulannya tidak berubah — model C lebih
> jujur dan tidak mengambil ruang tawar Sales — tapi uji memakai angka ini, dihitung dari
> pricelist, bukan angka lama. Angka model B di tabel pembanding juga dari harga lama.

## Skema

Jangkarnya `po_rombel`, yang SUDAH menyimpan jumlah siswa per kelas per rombel.

```sql
alter table po_rombel   add column kelompok smallint not null default 1;
alter table po_komponen add column kelompok smallint not null default 1;

create table po_kelompok (
  po_id       uuid     not null references po(id) on delete cascade,
  nomor       smallint not null,
  nama        text,                    -- "Kelas 12", "Kelas 10-11 IPA"; boleh kosong
  harga_siswa bigint   not null default 0,
  primary key (po_id, nomor)
);
```

Tiga aturan yang menahan bentuknya:

1. **Tiap rombel milik TEPAT SATU kelompok.** Karena `kelompok` adalah kolom di
   `po_rombel`, siswa mustahil terhitung dua kali — bukan dilarang kebijakan,
   melainkan tidak bisa dinyatakan.
2. **Jumlah siswa kelompok TIDAK PERNAH diketik**, selalu
   `sum(po_rombel.jumlah_siswa) where kelompok = n`. Ini yang membuat dokumennya
   bisa berbunyi "Tryout — kelas 12, 100 siswa" dan bisa dicek siapa pun.
3. **`default 1` membuat migrasi tidak menyentuh PO lama sama sekali**: seluruh
   rombel dan komponennya jatuh ke kelompok 1, dan hasilnya identik dengan hari ini.

`po.harga_siswa` dan `po.jumlah_siswa` tetap ada sebagai ringkasan turunan supaya
kueri lama tidak pecah; keduanya diisi dari kelompok 1 bila kelompoknya cuma satu.
Untuk PO berkelompok banyak, `po.grand_total` yang menjadi angka sahnya.

**Guru tetap di tingkat PO.** Pelatihan guru tidak mengikuti angkatan siswa, jadi
`jumlah_guru` dan `harga_guru` tidak dipindah ke kelompok.

## Perhitungan

Untuk tiap kelompok `n`:

```
siswa(n)  = sum(po_rombel.jumlah_siswa where kelompok = n)
komponen(n) = po_komponen where kelompok = n
harga(n)  = hitung(komponen(n), siswa(n))    // paket ATAU a la carte, aturan lama
```

`grand_total = Σ harga(n).total + harga_guru × jumlah_guru`

Pencocokan paket (`paketDari`) berjalan **per kelompok**, tidak berubah aturannya.
Konsekuensinya satu PO bisa memuat satu kelompok berharga paket dan kelompok lain
a la carte — itu memang yang diinginkan.

## Lantai harga

`periksa()` menegakkan lantai **per kelompok**: `kelompok.harga_siswa` tidak boleh
di bawah `harga(n).perSiswa[1]`. Ini bagian yang paling perlu QA, karena satu PO
kini punya beberapa lantai sekaligus.

> **Sekaligus tutup lubang lama.** Lantai hari ini HANYA ditegakkan di server action;
> RLS `po_buat` mengizinkan peran sales menulis ke `po` tanpa pemeriksaan harga sama
> sekali — sudah dibuktikan bisa ditembus lewat PostgREST (lihat
> `catatan/02-jebakan-dan-bug.md`). Dengan lantai per kelompok, permukaannya melebar.
> Trigger lantai di basis data harus masuk di pekerjaan yang sama, bukan ditunda lagi.

## Layar

Bentuk yang dipilih: form menampilkan **daftar kelompok**, bukan mencentang kelas
pada tiap komponen. Alasannya, "Kelompok 1: kelas 12, paket LMS Juara" adalah cara
sekolah sendiri berpikir, sedangkan menandai 8 komponen dengan kelasnya masing-masing
menuntut Sales menyusun ulang informasi yang sama di kepalanya.

- Bawaan: **satu kelompok berisi semua kelas** — layarnya persis seperti sekarang.
- Tombol "Tambah kelompok" memunculkan kelompok kedua; Sales memindahkan rombel ke
  sana lewat pemilih kelas/rombel.
- Rombel yang belum masuk kelompok mana pun ditandai jelas: itu siswa yang tidak
  tertagih, dan diam-diam kehilangan mereka lebih berbahaya daripada ditolak.
- Tiap kelompok punya panel tier sendiri berikut keterangan paket/a la carte yang
  sudah ada.

## Dampak ke dokumen

Ini bagian yang paling hati-hati: dokumen ini ditandatangani sekolah.

- Tabel harga Form PO berubah dari satu baris "Siswa" menjadi **satu baris per
  kelompok**, dengan nama kelompok dan jumlah siswanya. Baris "Guru" tidak berubah.
- "Rincian Paket" disebut per kelompok.
- **PO lama wajib tercetak persis seperti semula.** PO satu kelompok harus
  menghasilkan dokumen yang sama byte-per-byte dengan sebelum perubahan — ini
  diuji, bukan diasumsikan.
- PKS dan Surat Verifikasi ikut menyesuaikan. `namaPaketPks` **tidak** berubah —
  lihat bagian Keputusan di bawah.

## Analitik

Agregat hari ini menjumlah per PO dengan asumsi satu harga per siswa. Perlu
disesuaikan agar tidak salah hitung. Sebaran paket juga: satu PO kini bisa
menyumbang ke lebih dari satu paket.

## Urutan pengerjaan

1. Migrasi skema + backfill kelompok 1, tanpa perubahan perilaku. Diuji: seluruh
   PO lama menghasilkan harga dan dokumen yang identik.
2. ~~Trigger lantai di basis data~~ — **sudah dibangun 9 Sep 2026** (commit 1600a1b),
   terpisah dan lebih dulu, tinggal diterapkan ke basis data. Fungsinya masih menghitung
   lantai per PO; begitu kelompok ada, `private.lantai_siswa()` perlu dihitung per
   kelompok.
3. Perhitungan dan `periksa()` per kelompok.
4. Layar daftar kelompok.
5. Dokumen PO, lalu PKS dan Surat.
6. Analitik.

Langkah 1 dan 2 tidak mengubah apa pun yang dilihat Sales, jadi keduanya bisa naik
lebih dulu dan diverifikasi tenang sebelum sisanya menyusul.

### Langkah 1 — apa yang dibangun, dan yang sengaja belum (10 Sep 2026)

Migrasi `20260910m`: `kelompok smallint not null default 1` di `po_rombel` dan
`po_komponen`, **dikunci `check (kelompok = 1)`** (`*_kelompok_satu_dulu`).

- **Kenapa dikunci.** Tanpa kunci, peran sales bisa menulis kelompok 2 lewat PostgREST
  sekarang juga, sementara `lantai_siswa()` masih menjumlah semua komponen PO dan
  `po_komponen` masih berkunci `(po_id, komponen_id)`. Spesifikasi ini mensyaratkan
  lantai per kelompok masuk bersama pelebaran permukaannya. Langkah 3 yang membukanya:
  lepas kedua constraint, perluas kunci primer `po_komponen` dengan `kelompok`, hitung
  `lantai_siswa()` per kelompok.
- **`po_kelompok` belum dibuat.** Ia hanya berarti kalau ada yang menulisnya; membuatnya
  sekarang berarti setiap PO baru lahir tanpa baris kelompok sampai langkah 3.
- **`uji/emas.test.mjs`** merekam Form PO, Surat, PKS, dan harga+lantai tiga PO contoh
  (SMA paket + guru, SD a la carte + add-on bersesi, SMP paket CUSTOM) SEBELUM kode
  disentuh — penjaga "PO lama tercetak persis sama" untuk seluruh langkah berikutnya.
  Hanya tier Price List dan Bottom yang direkam.
- **`KELAS` disatukan** di `lib/kelas.ts`, berkas tanpa impor: form PO adalah komponen
  klien, dan mengimpornya dari `dokumen-dari-po.ts` akan menyeret `pricelist.ts` ke
  peramban.

Dibuktikan dengan rollback: 18 rombel dan 13 komponen yang ada seluruhnya kelompok 1;
kelompok 2 ditolak di kedua tabel; insert tanpa kolom kelompok (bentuk `simpanDraf`
hari ini) jatuh ke kelompok 1; lantai PO-67 dan PO-1 tetap 163.000 dan 186.000.

### Langkah 3 — dipersempit, dan kenapa sisanya harus satu rilis (12 Sep 2026)

Catatan langkah 1 menulis kunci `kelompok = 1` dibuka di langkah 3 bersama lantai per
kelompok. **Itu dikoreksi.** Membaca `simpanDraf` dan trigger lantai memperlihatkan bahwa
pembukaan setengah jalan menciptakan jalan pintas lantai harga:

> Bila `po_kelompok` ada dan trigger lantai membaca harga dari sana "kalau barisnya ada",
> Sales bisa menyisipkan `po_kelompok(1, harga tinggi)` lewat PostgREST lalu menurunkan
> `po.harga_siswa` di bawah lantai. Trigger memeriksa harga kelompok yang tinggi dan
> meloloskan PO, sementara yang ditagih dan dicetak adalah `po.harga_siswa` yang rendah.
> Gerbang pengecualian punya celah kembar: ia membandingkan `po.harga_siswa`.

Kesimpulannya, empat hal ini masuk **dalam satu migrasi dan satu rilis**, tidak dicicil:
tabel `po_kelompok` + lantai per kelompok di basis data (termasuk gerbang pengecualian dan
sidik tinjauan PO unggahan, yang harus ikut menyidik `po_kelompok`); penulisannya di
`simpanDraf` + `periksa()` per kelompok; layar daftar kelompok; dan dokumen. Kunci
`*_kelompok_satu_dulu` dilepas di migrasi yang sama. Uji emas menjaga PO satu kelompok
tetap identik di sepanjang jalan.

Yang dibangun di langkah 3 hanya yang aman berdiri sendiri: `lib/kelompok.ts`,
`hitungPerKelompok()` — fungsi murni yang nanti dipakai `periksa()`, layar, dan dokumen,
dengan `uji/kelompok.test.mjs`. Ia belum dipakai apa pun, jadi tidak ada yang berubah
untuk Sales dan tidak perlu deploy.

Keputusan kecil di dalamnya: jumlah siswa kelompok selalu jumlah rombelnya; komponen guru
dihitung sekali di tingkat PO dari kelompok mana pun; rombel berisi nol diabaikan seperti
form PO hari ini; dan lima bentuk tidak sah dilaporkan sebagai kalimat — siswa tak
tertagih, kelompok kosong, kelompok tanpa komponen, rombel ganda, nomor kelompok ganda.

### Rilis kelompok — langkah 4, 5, dan 6 sekaligus (12 Sep 2026)

Migrasi `20260912_kelompok_po_rilis.sql`. Bentuk yang sah, ditegakkan trigger `jaga_lantai_po`
saat PO meninggalkan draf:

| Bentuk | Aturan |
|---|---|
| Satu kelompok | **Nol** baris `po_kelompok`; harga di `po.harga_siswa`; semua di kelompok 1. PO lama tidak berubah. |
| Banyak kelompok | **Dua baris atau lebih**; `po.harga_siswa` wajib 0; `jumlah_siswa` = Σ rombel; `grand_total` = Σ harga × siswa + guru; tiap kelompok berisi siswa, punya komponen, tidak di bawah lantainya. |
| Tepat satu baris | **Ditolak** — bentuk jalan pintas lantai. |
| PO unggahan | Tetap satu kelompok (kertas Form PO hanya punya satu baris siswa); gerbang pengecualian menolak PO berkelompok. |
| Pelatihan Guru | Selalu kelompok 1 — tingkat PO. |

**Lubang lama yang ikut tertutup:** sebelum rilis ini tidak ada yang mencocokkan `grand_total`
dengan harga × jumlah, padahal angka itu yang dicetak di PKS dan jadi patokan termin. Kini
dicocokkan di kedua jalur. Kedua PO yang ada diperiksa konsisten lebih dulu.

**Dibuktikan tanpa diterapkan:** migrasi dan 17 skenario dijalankan dalam satu transaksi yang
dibatalkan (`execute_sql` menjalankan banyak pernyataan sebagai satu transaksi implisit;
`raise` di akhir membatalkan DDL-nya juga). Jalur lama diterima; jalan pintas satu baris,
`grand_total` palsu di kedua jalur, dan sembilan bentuk cacat PO berkelompok ditolak dengan
kalimat yang bisa ditindaklanjuti; RLS menolak Sales lain membaca dan menulis;
`po_kelompok` membeku sesudah draf; pengecualian ditolak untuk PO berkelompok; sidik
tinjauan ikut berubah. Sesudahnya diperiksa: tidak ada yang tertinggal.

**Aplikasi:**

- `ringkasan()` di `po-aksi.ts` — satu sumber angka untuk `periksa()` dan `simpanDraf()`.
  Setiap aturan (minimal peserta, kapasitas sesi, lantai) berlaku per kelompok.
- Perubahan susunan kelompok (nama, harga, kelas mana di kelompok mana) membasikan
  persetujuan keempat fungsi — `kelompok` di `WILAYAH`.
- Layar: panel "Kelompok Siswa" (tidak muncul untuk PO unggahan); kartu per kelompok berisi
  nama, harga dengan batas bawahnya, paket siap pakai, fitur inti, add-on; Pelatihan Guru
  dipisah ke tingkat PO; kolom Kelompok per angkatan di tabel rombel; panel harga menjumlah
  seluruh kelompok. Menghapus sampai tinggal satu mengembalikan layar ke mode satu kelompok.
- Dokumen: Form PO satu baris "Rincian" dan satu baris harga per kelompok; Surat menyebut
  paket per kelompok; PKS tetap bernama pendek, rincian per angkatan di daftar layanan.
  Nama kelompok yang dikosongkan tercetak sebagai "Kelas 10, 11".
- Analytics: diskon PO berkelompok dihitung per kelompok terhadap isinya — dulu PO seperti
  itu (harga_siswa 0) akan terlewat diam-diam.
- `uji/emas` bertambah satu PO berkelompok; ke-12 rekaman lama tidak berubah satu byte pun.

**QA independen:** putaran pertama FAIL — satu blocker: kartu kelompok dan harga bawaan
dicocokkan per POSISI, sehingga urutan [1, 3, 2] menampilkan angka kelompok lain dan
harga yang dikosongkan terisi Price List kelompok lain. Diperbaiki dengan pencarian per
nomor (`5ce9011`), bersama batas nama 60 karakter dan nomor 1–6 yang kini ditolak sebelum
apa pun ditulis. Putaran kedua PASS.

**Penerapan:** migrasi diterapkan tepat sebelum deploy, lalu ke-17 skenario dijalankan
ulang terhadap skema yang TERPASANG (dalam transaksi yang dibatalkan) — semuanya lolos,
termasuk TRUNCATE yang kini ditolak untuk Sales. Sesudahnya: tidak ada data uji tertinggal,
advisor keamanan tanpa temuan baru, chunk publik produksi bersih dari angka Acquisition.

**Catatan kecil dari QA, belum dikerjakan:** nama berisi emoji diperiksa lebih ketat daripada
basis data (arahnya aman); draf dengan urutan kelompok tak berurut menampilkan kartu dalam
urutan simpan sementara ringkasan per nomor (angkanya benar); harga desimal dari permintaan
rakitan baru ditolak basis data sesudah persetujuan dibasikan — celah yang sama sudah ada
di jalur satu kelompok.

**Sengaja belum:** pengelompokan per rombel (skemanya siap, layarnya per angkatan); kelompok
untuk PO unggahan; peringatan saat harga kelompok dikosongkan dan diam-diam memakai Price List.

## Keputusan (validasi 9 Sep 2026)

**Pengelompokan per angkatan dulu, rombel menyusul.** Layar bekerja per angkatan —
kelas 10, 11, 12 — yang menutupi contoh Santamaria dan kemungkinan besar mayoritas
kasus. Skemanya sengaja tidak menutup pilihan: karena `kelompok` menempel di
`po_rombel`, dukungan per rombel bisa ditambah kelak tanpa migrasi baru.

**Tidak ada batas jumlah kelompok yang terpisah** — modelnya sudah membatasi sendiri.
Karena pengelompokan per angkatan dan tiap rombel hanya boleh di satu kelompok, jumlah
kelompok mustahil melebihi angkatan yang ada: SD 6, SMP 3, SMA 3.

> Usul awal "maksimal 4, sejalan dengan batas termin" **salah**, dan ketahuan saat
> diperiksa: `KELAS` di `lib/dokumen-dari-po.ts` menunjukkan SD punya enam angkatan
> (kelas 1–6), jadi batas 4 akan memblokir kasus yang sah. Angka yang dikarang karena
> terdengar rapi hampir selalu begitu.

Yang tetap dijaga: **tidak ada rombel di dua kelompok** (dijamin skema) dan **tidak ada
kelompok kosong**. Keduanya perlu apa pun jawabannya soal batas.

**Nama paket di PKS tetap pendek**, mengikuti aturan `namaPaketPks` yang sudah ada —
paket terbesar yang termuat plus penanda CUSTOM. Alasannya konkret: nama paket muncul
**empat kali** di dokumen PKS, tertanam dalam kalimat hukum ("PEMBELIAN PAKET …",
"dalam PAKET …", "layanan PAKET …"), jadi nama panjang akan terbaca janggal berulang
kali di lembar bermeterai. Rincian per angkatan masuk ke daftar **layanan**, yang memang
sudah berbentuk enumerasi.

**Pelatihan Guru tetap di tingkat PO**, tidak ikut kelompok — dikonfirmasi, bukan lagi
asumsi. Satu `jumlah_guru` dan satu `harga_guru` untuk seluruh PO, ditambahkan di atas
total seluruh kelompok.

## Catatan pinggir

`KELAS` didefinisikan **dua kali** — di `lib/dokumen-dari-po.ts` dan
`app/(sistem)/po/baru/form-po.tsx`. Belum menggigit, tapi pekerjaan ini akan
menyentuh keduanya, jadi sekalian disatukan saat itu.

## Uji yang wajib ada

- PO satu kelompok menghasilkan harga, lantai, dan dokumen yang identik dengan
  sebelum perubahan — penjaga utama seluruh pekerjaan ini.
- Rombel tidak bisa masuk dua kelompok (dijaga skema, dibuktikan di uji).
- Jumlah siswa kelompok selalu sama dengan jumlah rombelnya; tidak ada jalur yang
  menerima angka ketikan.
- Lantai ditolak per kelompok, dan ditolak di basis data, bukan hanya di server action.
- Contoh Santamaria menghasilkan Rp86.900.000 dengan lantai Rp50.600.000 (pricelist 4.0;
  angka lama Rp90.500.000/Rp55.400.000 berasal dari harga sebelum 4.0 — lihat koreksi di atas).
