# Keputusan Arsitektur

Keputusan yang punya alasan kuat dan mahal kalau dibalik tanpa tahu sebabnya.

## Pricelist tetap di kode, tidak pernah masuk basis data

Postgres tidak punya keamanan tingkat kolom yang praktis. Menyimpan
Acquisition Price di luar basis data membuat kebocorannya mustahil secara
struktur, bukan sekadar dilarang kebijakan. **Jangan memindahkan pricelist ke DB.**

Pola yang sama dipakai lagi saat menutup [[Daftar Pengguna]]: RLS bekerja per
baris, jadi kolom `peran` tidak bisa disembunyikan dengan kebijakan — tabelnya
ditutup dan kebutuhan sah dilayani fungsi yang mengembalikan dua kolom saja.

### Amandemen sempit, 9 Sep 2026: price list dan bottom BOLEH masuk DB

Lantai harga harus ditegakkan di basis data, dan trigger tidak bisa menghitung lantai
tanpa tahu harganya. Maka **price list dan bottom price disimpan di tabel
`harga_komponen`/`harga_paket`. ACQUISITION PRICE TETAP TIDAK PERNAH.**

Ini bukan pembatalan: alasan aturan di atas seluruhnya tentang melindungi acquisition,
sementara bottom price memang dilihat semua peran (`lib/po-aksi.ts`: "Semua peran
melihat Bottom Price"). Yang dilindungi tetap terlindungi.

Harganya jadi **salinan ketiga**, dan itu risiko nyata. Pagarnya tiga: seed
`supabase/harga-db.sql` DIHASILKAN dari `lib/pricelist.ts` oleh `uji/buat-harga-db.mjs`
dan tidak pernah diketik tangan; `uji/harga-db.test.mjs` membandingkan keduanya tiap
kali dijalankan; dan uji yang sama memeriksa acquisition tidak ikut **per angka, bukan
per kata** — karena yang bocor adalah angkanya, bukan namanya. Tabelnya sendiri ditutup
dari `anon` dan `authenticated`; hanya fungsi `SECURITY DEFINER` yang memakainya.

## Kalkulator diduplikasi, bukan dipindahkan

`skolla-pricing-calculator.vercel.app` tetap berdiri sendiri sebagai cadangan.
Konsekuensinya dua salinan harga bisa menyimpang; penjaganya cap
`VERSI_PRICELIST` yang ada di kedua aplikasi. Setiap perubahan harga wajib
dilakukan di dua tempat.

Yang diduplikasi adalah **angkanya**, bukan aplikasinya. Kalkulator tidak pernah
jadi cadangan platform — ia tidak mencatat PO, tidak mengurus verifikasi, dan
tidak menerbitkan PKS. Yang ia cadangkan satu hal: angka yang dikutip Sales.
Fungsinya karena itu dipersempit 22 Sep 2026 — generator Form PO di sana
dihapus, dan ia tinggal jadi alat hitung.

Aturan peserta ikut disamakan, bukan hanya harganya. Kalkulator kini juga
menegakkan `KAPASITAS_SESI`, yang sebelumnya hanya ada di sini: kalkulator
meloloskan satu sesi untuk 900 siswa, lalu PO-nya ditolak platform setelah
angkanya terlanjur dikutip ke sekolah. Sejak itu `KAPASITAS_SESI` ikut masuk
`CAP_LENGKAP` di `uji/pricelist.test.mjs` kedua repo.

## Keputusan verifikasi tidak pernah dihapus

Yang basi ditandai `berlaku = false` beserta `sebab_basi`. Menghapusnya berarti
catatan "Finance menolak karena termin tidak cocok" lenyap begitu diperbaiki —
padahal jejak itulah yang menjelaskan kenapa harganya berubah.

Hasil verifikasi ada tiga, bukan dua: setuju, **setuju dengan catatan**, tolak.
Dokumen checklist aslinya memang punya tiga kesimpulan.

## Angka nomor PKS diisi tangan

Penomoran dipakai bersama banyak jenis dokumen di luar sistem ini, jadi
urutannya tidak bisa ditentukan dari sini tanpa bentrok. Sistem hanya mencetak
ekornya: `/EXTSKOLLA/PKS/<bulan romawi>/<tahun>`.

## Pasal 6 ayat 5 sengaja menyimpang dari PKS asli

PKS asli menyatakan nilai "belum termasuk pajak" dan membebankannya ke sekolah.
Itu bertentangan dengan pricelist yang harganya sudah termasuk pajak. Rizki
memutuskan pricelist yang benar dan templatnya yang diperbaiki.

## PDF PKS dirakit di server, bukan lewat dialog cetak

Margin, kop bawaan, dan penskalaan berbeda-beda per perangkat. PDF-nya dikunci
(boleh cetak, tidak boleh sunting atau salin) — itu **penghalang, bukan
pengaman**; yang mengikat tetap tanda tangan basah di atas meterai.

## Perpindahan status lewat fungsi basis data

Kebijakan `po_ubah` sengaja tidak mengizinkan Sales menyentuh PO yang sudah
terverifikasi. Melonggarkannya demi satu langkah membuka pintu untuk semua
langkah, jadi `finalisasi_pks` dan `unggah_pks_basah` mengerjakannya sebagai
fungsi `security definer` yang memeriksa izinnya sendiri.

## Berkas diunggah langsung dari peramban

Badan Server Action dibatasi 1MB, sementara pindaian PKS belasan megabyte.
Yang lewat server hanya pencatatannya.

## Tema bawaan terang

Tidak mengikuti setelan sistem. Tidak ada blok `prefers-color-scheme`; gelap
hanya lewat `[data-theme="dark"]`.
