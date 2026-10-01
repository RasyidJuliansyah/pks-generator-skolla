# Spesifikasi: Nilai sponsorship dan batas 15%

Status: **DIBANGUN 20 Sep 2026** (rencana kerja `catatan/19`, enam tugas, semua commit).
Dirancang dan disetujui Rizki 17 Sep 2026. Mengubah aturan IoM
(`catatan/13a`, Bagian 8, versi `iom-2026-09-17c`) dan menyentuh spesifikasi ekstraksi
(`catatan/17`). Didahulukan sebelum rencana kerja `catatan/17`.

## Masalah

Hari ini sponsorship hanya berupa catatan teks bebas (`po_catatan` jenis `sponsorship`). Sistem
tidak tahu nilainya, jadi tidak bisa memeriksa kepatuhannya. Karena itu aturan IoM
`tanpa-sponsorship` menggagalkan setiap PO yang punya catatan sponsorship, berapa pun nilainya.

Kebijakan Skolla: **sponsorship mengambil 15% dari pendapatan.** Spesifikasi ini membuat nilai
itu tercatat, diperiksa, dan dipakai verifikasi otomatis.

## Keputusan (Rizki, 17 Sep 2026)

| Hal | Keputusan |
|---|---|
| Dasar 15% | **Grand total PO**, yaitu harga yang benar-benar disepakati dengan sekolah, termasuk add-on dan Pelatihan Guru |
| Hubungan dengan Bottom Price | **Hanya batas 15%.** Porsi 15% sudah ada dalam penetapan harga, jadi PO seharga Bottom Price tetap boleh bersponsorship 15%, walau pendapatan bersihnya di bawah Bottom Price |
| Sponsorship dalam batas | **Boleh lolos verifikasi otomatis.** Dokumen pendukung diperiksa di tahap PKS |
| Sponsorship di atas batas | **Verifikasi manual** (aturan IoM gagal), bukan diblokir |
| Bentuk nilai | **Satu angka Rupiah total.** Barang dan media dinilai dengan harga pokoknya bagi Skolla; rinciannya tetap di teks catatan |

## Batas per siswa (rujukan Sales)

15% dari harga per siswa, per sumber `lib/pricelist.ts` versi `af4fc50e4ac9`. Kalikan dengan
jumlah siswa (dan jumlah sesi untuk add-on). Acquisition Price sengaja tidak dicantumkan.
Tabel ini hanya rujukan; yang diperiksa sistem tetap 15% dari grand total PO yang sebenarnya.

**Paket**

| Paket | Price List | 15% | Bottom Price | 15% |
|---|---|---|---|---|
| LMS Juara | 350.000 | 52.500 | 186.000 | 27.900 |
| LMS Smart | 240.000 | 36.000 | 135.000 | 20.250 |
| LMS Lite | 100.000 | 15.000 | 66.000 | 9.900 |
| Bimbel UTBK/TKA Premium | 285.000 | 42.750 | 120.000 | 18.000 |
| Bimbel UTBK/TKA Lite | 150.000 | 22.500 | 99.000 | 14.850 |
| Asesmen Psikologi | 75.000 | 11.250 | 50.000 | 7.500 |
| Tryout | 25.000 | 3.750 | 20.000 | 3.000 |

**Komponen satuan**

| Komponen | 15% Price List | 15% Bottom Price |
|---|---|---|
| LMS | 15.000 | 9.900 |
| Modul | 2.250 | 1.650 |
| Video | 4.350 | 2.850 |
| Latihan Soal | 9.000 | 5.850 |
| Asesmen Psikolog | 11.250 | 7.500 |
| Tryout | 3.750 | 3.000 |
| Live Class | 4.800 | 3.150 |
| Analisis SNBP | 600 | 450 |

**Add-on, per siswa per sesi** (Pelatihan Guru per guru per sesi)

| Add-on | 15% Price List | 15% Bottom Price |
|---|---|---|
| Konsultasi Online | 7.800 | 5.100 |
| Pendalaman Materi (offline) | 6.750 | 4.200 |
| Pendalaman Materi (online) | 4.800 | 3.150 |
| Psikolog Klasikal (offline) | 22.500 | 13.650 |
| Psikolog Klasikal (online) | 14.250 | 8.400 |
| Pelatihan Guru (offline) | 22.500 | 12.300 |
| Pelatihan Guru (online) | 7.500 | 3.450 |

Contoh: 240 siswa LMS Smart pada Price List = Rp57.600.000, sponsorship paling banyak
Rp8.640.000. Pada Bottom Price = Rp32.400.000, paling banyak Rp4.860.000.

Bila harga di `lib/pricelist.ts` berubah, tabel ini diperbarui bersama cap versinya (uji
menghitung ulang dari `KOMPONEN` dan `PRESET`, lihat "Uji").

## Data

1. **Kolom baru `po.nilai_sponsorship`**: bigint Rupiah utuh, boleh kosong, `check (>= 0)`.
2. **Simpan draf tetap bebas.** Syaratnya ditegakkan saat keluar draf oleh trigger
   `po_syarat_maju` yang sudah ada (kirim untuk tanda tangan, atau ajukan unggahan), hanya untuk
   PO yang dicap `versi_iom` baru:
   - catatan sponsorship berisi menuntut `nilai_sponsorship > 0`;
   - `nilai_sponsorship > 0` menuntut catatan sponsorship berisi.
3. **Ikut dibekukan dan dilacak perubahannya.** Nilai yang berubah dihitung sebagai perubahan
   wilayah `sponsorship` (bersama teks catatannya) di `lib/po-aksi.ts`, sehingga keputusan
   Finance menjadi basi dan versi PO naik.
4. **Rumus batas, bilangan bulat:** `nilai_sponsorship * 100 <= grand_total * 15`. Tanpa
   pecahan, jadi pembulatan tidak pernah menentukan hasil. Sama persis di TypeScript dan SQL.

## Aturan IoM

`tanpa-sponsorship` diganti **`sponsorship-dalam-batas`** (versi `iom-2026-09-17c`):

| Keadaan | Hasil | Bukti |
|---|---|---|
| Tanpa catatan dan tanpa nilai | lolos | `tidak ada` |
| Nilai dalam batas | lolos | `Rp4.860.000 = 15,0% dari Rp32.400.000, batas Rp4.860.000` |
| Nilai di atas batas | gagal | bentuk yang sama |
| Catatan tanpa nilai, atau nilai tanpa catatan | gagal | `catatan dan nilai sponsorship tidak berpasangan` |

Baris terakhir mestinya tidak terjadi pada PO berstempel baru karena trigger keluar draf, tetapi
aturannya tetap menilai sendiri (gagal tertutup), bukan mengandalkan trigger.

Yang berubah bersama, dalam satu migrasi dan satu commit:

- `lib/iom.ts`: fakta `adaSponsorship` diganti `catatanSponsorship: boolean` dan
  `nilaiSponsorship: number | null`, `grandTotal` sudah ada; kode aturan baru; `VERSI_IOM`.
- `private.nilai_iom` dan `private.versi_iom_berlaku()`: aturan dan versi yang sama.
- `lib/verdict-iom.ts`: label `'sponsorship-dalam-batas': 'Sponsorship dalam batas 15%'`.
- Uji kesamaan kode aturan TS dan SQL yang sudah ada menjaga keduanya tetap sama.

Verdict lama (versi `iom-2026-09-17b`) otomatis terbaca `basi` oleh tampilan Fase 3a. Per
17 Sep 2026 produksi belum punya satu verdict pun.

## Dokumen sponsorship di tahap PKS

Berlaku untuk **setiap PO bersponsorship**, lolos otomatis maupun manual.

1. **Kotak "Dokumen Sponsorship" di halaman PKS**, tampil bila PO punya catatan atau nilai
   sponsorship. **Finance** (pemilik butir `d4`) mencentang tiga pernyataan lalu menyimpan:
   - Form Sponsorship atau Form Hibah beserta Berita Acaranya sudah ditandatangani;
   - rekening penerima atas nama sekolah, yayasan, atau badan hukum, bukan perorangan;
   - hibah di atas Rp5.000.000 memakai meterai Rp10.000 pada Berita Acaranya.
2. **Tabel baru `pks_dokumen_sponsorship`**: `po_id`, `versi_po`, ketiga centang, `oleh`,
   `pada`. Hanya Finance yang boleh menulis (peran harfiah `finance`), semua yang boleh melihat
   PO boleh membaca. Konfirmasi dengan `versi_po` yang bukan versi PO sekarang tidak berlaku.
3. **Ditegakkan basis data:** `unggah_pks_basah` menolak unggahan PKS bertanda tangan basah
   selama PO bersponsorship belum punya konfirmasi yang berlaku dengan ketiga centang. Unggahan
   itu langkah terakhir kesepakatan, dan dokumen sponsorship ditandatangani bersama PKS.
4. **PO lama tanpa nilai** (dibuat sebelum versi ini) tetap wajib dikonfirmasi dokumennya;
   nilainya tidak dituntut.

Butir 3 itu gerbang yang menolak. Sejak 22 Sep 2026 ada dua hal yang memberi tahu lebih dulu
(`catatan/22`): catatan kuning di langkah Penanda begitu nilai atau catatan sponsorship diisi,
dan antrean "Menunggu konfirmasi dokumen" bagi Finance di daftar PKS begitu PKS-nya difinalisasi.
Keduanya hanya cara memberi tahu — yang menolak tetap basis data.

## Layar

- **Wizard, langkah Penanda tangan & catatan:** isian "Nilai sponsorship (Rp)" di bawah catatan
  sponsorship, dengan bantuan "Total nilai, termasuk barang dan media dengan harga pokoknya bagi
  Skolla." Di bawahnya batas yang hidup, contoh "Batas 15%: Rp4.860.000". Di atas batas: kotak
  kuning "Di atas 15% dari total. PO ini akan diverifikasi manual." Bukan galat: melewati batas
  hanya mengirim PO ke keempat fungsi. Halangan langkah bila catatan dan nilai tidak berpasangan.
- **Halaman PO dan kartu Finance di panel verifikasi:** nilai, persentasenya dari grand total,
  dan batasnya.
- **Form PO tercetak:** "Nilai: Rp…" di bawah isi catatan sponsorship, supaya sekolah
  menandatangani angkanya.
- **Kartu verdict:** label aturan baru.
- **Halaman PKS:** kotak Dokumen Sponsorship (Finance menyunting, peran lain melihat statusnya),
  dan pesan di tombol unggah PKS basah bila masih menunggu konfirmasi.
- **Daftar PKS, untuk Finance saja:** bagian "Menunggu konfirmasi dokumen" berisi PO
  bersponsorship yang PKS-nya sudah final dan konfirmasinya belum berlaku, dengan tautan
  langsung ke PKS-nya (`catatan/22`).
- **Halaman PO:** pemberitahuan sponsorship pada status yang terkunci, dengan tautan ke
  halaman PKS-nya (`catatan/22`).

Seluruh teks disaring DESIGN.md dan antislop; dua tema; target sentuh 44px di layar sempit.

## PO yang sudah ada (produksi, 17 Sep 2026)

| PO | Status | Sponsorship | Akibat |
|---|---|---|---|
| PO-001 | `pks_terbit`, PKS final, PKS basah belum diunggah | ada catatan, tanpa nilai | unggahan PKS basahnya menunggu konfirmasi dokumen Finance |
| PO-067 | `verifikasi`, tanpa verdict | ada catatan, tanpa nilai | tetap di keempat fungsi seperti hari ini |

Tidak ada PO draf, jadi syarat keluar draf tidak menahan siapa pun saat rilis.

## Dampak ke `catatan/17` (ekstraksi scan)

- Form kertas tidak punya isian nilai sponsorship: **nilai tidak pernah diisi dari scan**, dan
  ditandai "wajib diisi Sales" bila catatan sponsorship terbaca.
- Sudah dicatat di `catatan/17`.

## Uji

1. **Aturan murni** (`uji/iom.test.mjs`): tanpa sponsorship lolos; tepat 15% lolos; satu Rupiah
   di atas gagal; catatan tanpa nilai gagal; nilai tanpa catatan gagal; bukti memuat nominal,
   persen, dan batas; grand total 0 dengan nilai > 0 gagal.
2. **Kesamaan TS dan SQL**: kode aturan sama; kasus batas (tepat 15%, lebih satu Rupiah) memberi
   hasil sama di `lib/iom.ts` dan `private.nilai_iom`, dibuktikan dalam transaksi yang dibatalkan.
3. **Tabel rujukan** di berkas ini dihitung ulang dari `lib/pricelist.ts` (uji membaca tabel dan
   membandingkan), supaya perubahan harga tanpa pembaruan tabel jatuh di uji.
4. **Bukti basis data dalam transaksi yang dibatalkan:**
   - keluar draf dengan catatan tanpa nilai: ditolak; nilai tanpa catatan: ditolak; PO tanpa
     stempel baru: tidak dituntut;
   - `nilai_sponsorship` negatif: ditolak;
   - perubahan nilai membasikan keputusan Finance dan menaikkan versi;
   - konfirmasi dokumen oleh selain Finance: ditolak;
   - unggah PKS basah tanpa konfirmasi berlaku: ditolak; dengan konfirmasi versi lama: ditolak;
     dengan konfirmasi berlaku: diterima; PO tanpa sponsorship: tidak dituntut;
   - verdict: dalam batas lolos, di atas batas gagal.
5. **Pratinjau** isian nilai (dalam batas, di atas batas, tidak berpasangan), kotak Dokumen
   Sponsorship, dan baris nilai di Form PO; dua tema, lebar 1200 dan 375.
6. **Penyaring:** `npm run periksa`, build, `uji/pindai-bundel.mjs`, QA independen sebelum deploy.

## Di luar lingkup

- Pengelolaan pembayaran sponsorship kepada sekolah (kapan dan berapa dibayarkan).
- Templat Form Sponsorship, Form Hibah, dan Berita Acara (masih penahan peluncuran di
  `catatan/05`).
- Rincian nilai per jenis (dana, barang, media).
