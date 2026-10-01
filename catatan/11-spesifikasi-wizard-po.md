# Spesifikasi: Form PO sebagai wizard langkah demi langkah

Status: **tayang di produksi 14 Sep 2026** (dirancang dan disetujui Rizki 14 Sep 2026).
QA independen tiga putaran: putaran 1 GAGAL (teks `.sr` di bilah langkah melebarkan
halaman ponsel), putaran 2 GAGAL (ringkasan harga di Tinjau melayang di atas kaki
langkah); keduanya diperbaiki, putaran 3 LULUS. Pindai bundel: 24 chunk build lokal
commit yang sama dan 11 chunk publik produksi bersih dari angka khas Acquisition; chunk
halaman bersesi di produksi tidak bisa diambil tanpa masuk, jadi dijaga oleh build lokal
dan `uji/batas-harga.test.mjs`. Ini sub-proyek
pertama dari dua; sub-proyek kedua (ekstraksi otomatis dari scan PO, berikut gerbangnya)
dicatat di `catatan/08-spesifikasi-po-unggahan.md`, bagian "Ekstraksi: keputusan 14 Sep
2026", dan punya spesifikasinya sendiri nanti.

## Masalah

Form PO hari ini satu halaman panjang (`app/(sistem)/po/baru/form-po.tsx`, 969 baris):
pilihan jalur, scan, kelompok, komponen, data sekolah, rombel, harga, termin, catatan,
ringkasan harga, dan pratinjau dokumen, semuanya sekaligus. Untuk PO unggahan, Sales
mengetik seluruh isi kertas sambil menggulir bolak-balik antara scan dan isian.

Wizard memecahnya jadi langkah-langkah. **Isi, aturan, dan yang dikirim ke server tidak
berubah**; yang berubah hanya susunannya. Ekstraksi otomatis kelak mengisi langkah-langkah
yang sama.

## Keputusan (validasi 14 Sep 2026)

| Hal | Keputusan |
|---|---|
| Cakupan | **Kedua jalur**: PO platform dan PO unggahan memakai wizard yang sama |
| Urutan | Paket & harga **sebelum** Rombel, seperti form sekarang |
| Navigasi | Bilah langkah bisa diklik; "Lanjut" tidak pernah dikunci |
| Simpan | "Simpan draf" di setiap langkah, aturan simpan tidak berubah |
| Cetak | Hanya di langkah Tinjau |
| Struktur kode | Dipecah: hook state, komponen per langkah, kerangka wizard |
| Urutan sub-proyek | Wizard dulu tanpa ekstraksi; ekstraksi menyusul (pendekatan A) |

## Langkah

| # | Langkah | Isi | PO unggahan: di samping |
|---|---|---|---|
| 0 | Cara membuat | Pilih platform/unggahan; unggahan memilih scan PDF. Hanya saat membuat PO baru | Tidak ada |
| 1 | Sekolah | Data sekolah dan jenjang | Scan halaman 1 |
| 2 | Paket & harga | Kelompok (bila dipisah), paket, fitur inti, add-on, Pelatihan Guru, harga siswa/guru dengan batas bawahnya | Scan halaman 1 |
| 3 | Rombel | Jumlah siswa per kelas per rombel; kolom Kelompok bila PO berkelompok | Scan halaman 1 |
| 4 | Termin & masa aktif | Termin, masa aktif, sumber dana | Scan halaman 1 |
| 5 | Penanda tangan & catatan | Kota, tanggal tanda tangan, PM, SM, dua catatan | Scan halaman 2 lalu 3 |
| 6 | Tinjau | Pratinjau dokumen utuh, semua halangan simpan dan cetak, simpan, cetak; unggahan: pernyataan "sesuai dengan scan" | Scan utuh |

Konsekuensi urutan Paket sebelum Rombel, diterima sadar: di langkah 2 kartu kelompok
menampilkan "0 siswa" sampai rombel diisi, dan peringatan minimal peserta serta total
harga baru lengkap di langkah 3 dan Tinjau. Pemetaan kelas ke kelompok tetap di tabel
rombel.

Penampil scan membuka halaman tertentu lewat fragmen `#page=N` pada tautan PDF, tanpa
pustaka tambahan. Scan yang dipilih tapi belum tersimpan tetap memakai tautan objek lokal
seperti sekarang.

## Navigasi, validasi, penyimpanan

- **Bilah langkah** di atas dengan status per langkah: lengkap, ada halangan, belum
  dibuka. Semua langkah bisa diklik langsung.
- **"Lanjut" tidak pernah dikunci.** Draf memang boleh setengah jadi; tiap langkah
  menampilkan halangannya sendiri di tempat.
- **Halangan diberi label langkah di sumbernya**, bukan ditebak dari teks pesannya.
- **"Simpan draf" di setiap langkah**, dengan aturan simpan yang sama seperti hari ini.
  Selama ada halangan simpan, tombolnya menyebut halangan itu berikut tautan ke langkah
  pemiliknya.
- **Cetak hanya di Tinjau.**
- **PO baru dimulai di langkah 0; draf yang dibuka lagi langsung ke Tinjau**: gambaran utuh
  dulu, lalu lompat ke bagian yang dikoreksi.
- **Pernyataan "sesuai dengan scan" (unggahan) di Tinjau.** Isian apa pun yang berubah
  sesudah dicentang membatalkan centangnya, sejalan dengan server yang sudah membatalkan
  pernyataan saat isi berubah.
- **Ringkasan harga** tetap terlihat di langkah 2 sampai 6: menempel di samping di layar
  lebar, bilah ringkas di bawah layar pada ponsel.
- **Ponsel:** bilah langkah bisa digeser menyamping.

## Struktur kode

`form-po.tsx` dipecah tanpa mengubah logika:

- `app/(sistem)/po/baru/use-form-po.ts`: seluruh state dan turunannya (harga, kelompok,
  halangan, pratinjau dokumen, simpan), dipindah apa adanya.
- `app/(sistem)/po/baru/langkah/*.tsx`: satu komponen per langkah, JSX yang sudah ada.
- `app/(sistem)/po/baru/form-po.tsx`: kerangka wizard (bilah langkah, Kembali/Lanjut/Simpan,
  ringkasan harga, penampil scan). Antarmukanya ke `po/baru/page.tsx` dan
  `po/[id]/page.tsx` tidak berubah.
- `lib/langkah-po.ts`: fungsi murni daftar langkah dan status tiap langkah.
- Isi yang dikirim ke server disusun satu fungsi murni, diekstrak dari `simpan()` yang
  sekarang.

Wajib diikuti, dari `AGENTS.md` dan `DESIGN.md` (arah desain 12 Sep 2026):

- Teks layar tanpa tanda pisah "—"; titik dua, koma, atau kurung. Panah hanya untuk arah
  nyata ("← Kembali", "Lanjut →").
- Token `globals.css`, radius 10px, satu tingkat bayangan, garis kiri 4px hanya untuk kotak
  keadaan, lebar isi maks 1100px, target sentuh min 44px di layar ≤520px, tanpa animasi,
  tanpa ikon dan emoji. Dua tema, bawaan terang.
- Kueri baca baru dibungkus `wajib()` (`uji/kueri-baca.test.mjs`).
- Skill antislop dipakai sebagai penyaring untuk tampilan dan teks.

## Pengujian

1. **Sebelum wizard dibangun**, fungsi penyusun isi kiriman diekstrak dari form yang
   sekarang dan direkam hasilnya untuk tiga contoh: PO satu kelompok, PO berkelompok, PO
   unggahan. Wizard harus menghasilkan kiriman yang sama persis.
2. Status langkah diuji sebagai fungsi murni.
3. Dokumen tidak disentuh; `uji/emas` menjaganya.
4. Setiap langkah dipotret terang dan gelap, plus lebar 375px.
5. `npm run periksa`, build, `uji/pindai-bundel.mjs`.
6. QA independen sebelum deploy. Brief QA melarang membaca isi `.env*`.

## Di luar cakupan

- Ekstraksi otomatis dan gerbangnya (sub-proyek 2, `catatan/08`).
- Peringatan "ada perubahan belum disimpan" saat meninggalkan halaman; form sekarang juga
  tidak punya.
- Pengelompokan per rombel.
