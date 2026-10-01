# Penahan Peluncuran

Belum terjawab, dan menahan pemakaian sungguhan. Bukan pekerjaan koding.

## ~~Retensi berkas tanda tangan~~ — kebijakannya sudah diputuskan 9 Sep 2026

UU PDP 27/2022. Keempat pertanyaannya terjawab; lihat
`catatan/retensi-data-pribadi.md`: gambar tanda tangan 12 bulan, penghapusan dijalankan
Super Admin secara manual, sekolah diberi tahu di Form Pre-Order dan PKS, pindaian PKS
tetap di Supabase Storage.

**Yang tersisa bukan lagi keputusan, melainkan pekerjaan:**

1. Kalimat pemberitahuan **ditinjau orang legal** — ini kewajiban UU PDP, bukan teks
   yang boleh dikarang sendiri. Selama belum ditinjau, penahannya belum benar-benar
   lepas.
2. Kalimat itu dipasang di Form Pre-Order dan PKS, dengan masa simpan hidup sebagai
   satu konstanta supaya kedua dokumen tidak menyimpang.
3. Daftar jatuh tempo + tindakan hapus untuk Super Admin.

Butir 1 yang menahan; dua sisanya koding biasa.

### Tambahan 22 Sep 2026: kalimat Surat untuk PO otomatis juga menunggu legal

Sejak PO yang lolos IoM ditutup dan diterbitkan suratnya otomatis (catatan/13a Bagian 11),
Surat Verifikasi Kesiapan untuk PO seperti itu memakai kalimat baru: **sistem** yang
mengkonfirmasi menurut ketentuan IoM yang berlaku, dan Head of Operations serta Tech Ops Lead
disebut sebagai pihak yang diinformasikan.

Kalimat itulah yang dulu menahan Fase 3b: versi lamanya menyebut fungsi yang memutuskan, dan
untuk PO otomatis daftar itu kosong sehingga tercetak "dari sisi  untuk". Sekarang bentuknya
berganti, jadi **tinjauan legalnya berpindah, bukan hilang** — dan surat ini ikut ke sekolah,
jadi ia perlu ditinjau sebelum dipakai untuk PO sungguhan.

## Harga Acquisition terkirim ke peramban setiap pembuka form PO

**Diperbaiki dan tayang 12 Sep 2026** (`9cad316`, deploy `dr769tczu`, sesudah QA independen
PASS). Yang terbukti di produksi: chunk yang disajikan publik (10 berkas dari HTML `/masuk`)
bersih. Chunk form PO sendiri hanya disajikan ke pengguna yang sudah masuk, jadi untuknya
buktinya tidak langsung: build lokal dari commit yang sama bersih (0 dari 22 chunk), dan
Vercel membangun dari sumber yang sama. Nama chunk berbeda antara kedua build — hash-nya
tidak bisa dicocokkan satu per satu.

Penjaga graf impornya ditulis ulang dengan pengurai TypeScript 12 Sep 2026, setelah QA
membuktikan versi regex bisa dilewati (`export type A = {…};` sebelum impor nilai terbaca
sebagai satu impor tipe). Uji mutasi: enam varian tertangkap — pola lama itu, `import()`
dinamis, `export * from`, `import { type X, NILAI }`, 'use client' didahului komentar, dan
jalur lewat modul perantara — sementara impor tipe murni tetap lolos. `pindai-bundel.mjs`
**otomatis sejak 20 Sep 2026**: terdaftar sebagai `postbuild` di package.json, jadi ia jalan
sesudah setiap `npm run build` — termasuk di Vercel, yang log deploy-nya menunjukkan memang
menjalankan `npm run build`. Kebocoran sekarang MENGGAGALKAN deploy, bukan menunggu orang
ingat memindai.

Riwayat sebelumnya:

**Diperbaiki di kode 11 Sep 2026; produksi tetap bocor sampai perbaikannya di-deploy.**
`hitung.ts` tidak lagi mengimpor nilai harga (daftar komponen dan paket wajib dioper
pemanggil), dan aturan tanpa harga pindah ke `lib/aturan-komponen.ts`. Build ulang:
0 dari 22 chunk klien memuat angka khas Acquisition (sebelumnya 2). Dijaga dua lapis —
`uji/batas-harga.test.mjs` (graf impor, di setiap `periksa`; uji mutasi membuktikan ia
gagal begitu `hitung.ts` kembali mengimpor `KOMPONEN`) dan `uji/pindai-bundel.mjs`
(chunk build, sebelum deploy yang menyentuh harga). Tidak memakai paket `server-only`:
tidak terpasang, dan uji graf impor menutup hal yang sama tanpa dependensi baru.

Yang tidak bisa diperbaiki kode: angka Acquisition yang sudah pernah dimuat peramban
Sales sejak form PO dibuat. Kalau itu dianggap bocor sungguhan, yang perlu diputuskan
adalah soal harga, bukan soal sistem.

Catatan asal temuannya:

Ditemukan 10 Sep 2026, sudah ada sejak form PO dibuat. **Ini koding, bukan keputusan —
tapi ia menahan, karena bocor ke peran yang justru tidak boleh melihatnya.**

`form-po.tsx` adalah komponen klien dan mengimpor `hitung` dari `lib/hitung.ts`, yang
mengimpor NILAI `KOMPONEN`/`PRESET` dari `lib/pricelist.ts` sebagai parameter bawaan.
Bundler ikut mengirim seluruh larik ke peramban — tiga tier, termasuk Acquisition. Di
chunk hasil build tertulis harfiah `{id:"lms",…,p:[1e5,66e3,43e3]}`; 11 dari 13 angka
yang hanya ada di tier Acquisition ditemukan di dua chunk klien.

Artinya penyaringan `komponenUntuk(bolehAcquisition)` di server menyaring apa yang
TAMPIL, bukan apa yang TERKIRIM. Sales mana pun bisa membaca Acquisition dari tab
Network. Komentar di kepala `pricelist.ts` ("kebocoran mustahil secara struktur")
keliru dan perlu dikoreksi bersama perbaikannya.

Arah perbaikan: `hitung()` tidak boleh mengimpor nilai pricelist — daftar komponen
selalu dioper dari pemanggil (server sudah mengoper versi yang tersaring), metadata
yang dibutuhkan klien (`ID_GURU`, batas minimal, kapasitas) dipisah ke modul tanpa
angka harga, dan `pricelist.ts` diberi `import 'server-only'` supaya build GAGAL bila
kelak ada komponen klien yang menyeretnya lagi. Plus satu uji yang memindai chunk
build untuk angka khas Acquisition — pemindai yang menemukan ini tersimpan di
catatan sesi, belum jadi uji.

## Supabase masih paket free

Proyek mem-pause sendiri setelah ~1 minggu tanpa aktivitas — persis yang terjadi
pada skolla-partner-portal dan skolla-soal-generator. Di musim sepi sistem bisa
mati sendiri dan empat tim menemukannya tidak bisa diakses.

## ~~Delapan peran uji di akun rizki@~~ — sudah beres

Diperiksa 9 Sep 2026: `rizki@` tinggal memegang `admin_utama, head_of_operations`.

## Peran ganda yang tersisa, dan akibatnya

`farid@` memegang `finance` + `sales`, `bintang@` memegang `admin_sales` + `sales`.

Sejak trigger `jaga_verifikator_bukan_pembuat` dipasang (9 Sep 2026), PO yang dibuat
`farid@` **tidak bisa diverifikasi siapa pun di sisi Finance** — ia satu-satunya
pemegang peran itu. Pilihannya: cabut `sales` dari farid, atau tambah pemegang
`finance` kedua. Ini keputusan organisasi, bukan koding.

## ~~Lima peran belum terdaftar~~ — sudah beres

Diperiksa 9 Sep 2026: 13 pengguna terdaftar dan seluruh peran terisi.

## Belum tersambung

- Tidak ada yang memindahkan PO ke `aktif` atau `selesai`. Penyambungnya
  kemungkinan checklist bulanan Service Account, yang belum dibangun.
- Analytics masih kosong.
- Impor penjualan lama.
- Sponsorship/hibah: tiga jalur, enam templat.
- Kalkulator lama masih mengikuti setelan sistem, belum default terang.

## Dasbor tidak memperbarui diri

Setiap pemuatan menghitung ulang dari basis data (`force-dynamic`, tanpa
singgahan), tapi halaman yang dibiarkan terbuka tidak berubah sendiri. Perlu
tambahan kalau mau ditayangkan di layar bersama.
