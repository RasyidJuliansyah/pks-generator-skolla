# Kerjasama Sekolah — Skolla

Sistem alur kerjasama sekolah: Form Pre Order → verifikasi empat fungsi →
Surat Verifikasi Kesiapan → PKS → layanan berjalan.

Produksi: https://skolla-kerjasama.vercel.app

## Status

Alurnya sudah tersambung ujung ke ujung: pembuatan PO berikut pricelist dan
pemeriksaan bottom price, tanda tangan tiga pihak, verifikasi empat fungsi
dengan reset selektif saat PO direvisi, penerbitan dan finalisasi Surat
Verifikasi Kesiapan, penyusunan PKS berikut unduhan PDF yang terkunci izinnya,
unggahan PKS bermeterai, pengelolaan pengguna, serta Dashboard dan Analytics.

**Sejak 22 Sep 2026 ada dua jalur verifikasi, bukan satu** (`catatan/13a` Bagian
11). PO yang memenuhi seluruh aturan IoM ditutup dan diterbitkan suratnya
**otomatis oleh basis data**, sehingga PKS-nya langsung bisa dibuat; sementara
PO yang menyimpang (a la carte, diskon, sponsorship di atas 15%, ada permintaan
tambahan, unggahan, PO lama tanpa stempel) tetap lewat keempat fungsi seperti
biasa. Head of Operations dan Tech Ops Lead tidak lagi menutup apa pun; keduanya
menerima kabarnya lewat bagian "Terverifikasi otomatis IoM" di Antrean Verifikasi.
**Risiko yang disadari:** jalur otomatis tidak punya mata manusia sama sekali.

Belum ada: checklist bulanan Service Account — sehingga tidak ada yang
memindahkan PO ke `aktif` maupun `selesai`; jalur sponsorship dan hibah; impor
PO sales lama; Educator Partner; formulir Free Trial.

Kalkulator lama di `skolla-pricing-calculator` sengaja dibiarkan hidup sebagai
cadangan; angkanya diduplikasi, bukan dibagi. Isinya tinggal alat hitung —
Form PO dan PKS dibuat di sini — tapi aturan pesertanya wajib sama dengan yang
di sini, dan itu dijaga `uji/pricelist.test.mjs` di kedua repo.

## Keputusan arsitektur yang tidak boleh dibalik tanpa alasan

**Pricelist tetap di kode, bukan di basis data.** Angka Price List, Bottom Price,
dan Acquisition Price tidak pernah masuk Postgres. Postgres tidak punya keamanan
tingkat kolom yang praktis; menyimpannya di luar basis data membuat kebocoran
mustahil secara struktur, bukan sekadar dilarang kebijakan. Yang tersimpan hanya
harga kesepakatan yang memang tercetak di PO.

**Daftar pengguna adalah daftar izin.** Login Google yang sah tidak memberi akses
apa pun tanpa baris di tabel `pengguna`. Domain Workspace diperiksa terpisah.

**Fungsi pembantu ada di skema `private`.** Bukan `public` — supaya tidak terekspos
sebagai endpoint RPC oleh PostgREST. Jangan memindahkannya.

**Penjagaan ada di basis data, bukan di antarmuka.** Menyembunyikan tombol bukan
penjagaan: Server Action dan PostgREST bisa dipanggil tanpa melewati halaman
sama sekali. Setiap aturan yang penting punya padanannya sebagai kebijakan RLS,
trigger, atau pemeriksaan di dalam fungsi `SECURITY DEFINER`. Diagnostik
2026-08-30 menemukan lima tempat yang melanggar prinsip ini — antara lain PO
yang sudah ditandatangani masih bisa diubah nilainya lewat PostgREST — dan
menutupnya di `supabase/migrasi/`.

**Dokumen membaca salinan data sekolah yang beku di PO, bukan tabel `sekolah`.**
Baris `sekolah` dipakai bersama seluruh sales dan disatukan lewat NPSN, jadi
membacanya hidup berarti PKS yang sudah ditandatangani basah bisa mencetak nama
berbeda begitu sales lain membetulkan ejaannya. Salinan itu diisi trigger
`po_bekukan_sekolah` dan dikunci `po_bekukan_isi`. Pakai `sekolahDokumen(po)`,
jangan `po.sekolah`. Dijaga `uji/sekolah-beku.test.mjs`.

**Satu sekolah dipegang tepat satu Sales.** `sekolah.dipegang_oleh` diisi
trigger, dan Sales biasa hanya melihat sekolah yang dipegangnya. Penegakan
"tidak boleh dua sales di satu sekolah" bertumpu pada indeks unik parsial NPSN
yang sudah ada: sales kedua tidak melihat barisnya, penyisipannya ditolak
duplikat, dan `simpanDraf` menerjemahkan 23505 itu jadi kalimat yang bisa
dibaca. Serah terima lewat Head of Sales atau Admin Sales. **Jaminannya sekuat
NPSN** — sekolah tanpa NPSN masih bisa terduplikasi.

**Riwayat tak bisa dihapus, dua tabel.** `pengguna_riwayat` dan `po_riwayat`
sama-sama hanya punya kebijakan SELECT: diisi trigger `SECURITY DEFINER`, tidak
bisa disisipi maupun dihapus lewat PostgREST oleh siapa pun. Lini masa PO
dirangkai `lib/lini-masa.ts` dari lima sumber; datanya memang sudah ada sejak
awal, hanya tersebar.

**Peran pengawas baca-saja tidak perlu daftar larangan.** C Level, CBO, dan
Head of Operations hanya disebut di fungsi pembacaan. Setiap jalur tulis
menyebut perannya sendiri secara eksplisit, jadi peran yang tidak disebut di
mana pun otomatis tidak bisa menulis — sifatnya lahir dari bentuknya, bukan
dari daftar larangan yang harus dijaga tetap lengkap. Dijaga
`uji/peran-baca-saja.test.mjs`.

**Super Admin (`admin_utama`) berwenang atas segala hal yang bergantung peran**,
termasuk memberi keputusan verifikasi. Diterapkan di satu tempat —
`private.punya_peran` meloloskan `admin_utama` untuk peran apa pun — bukan
dengan menyisipkan namanya ke belasan daftar. Konsekuensinya `punya_peran('sales')`
benar bagi Super Admin yang bukan sales; fungsi itu MENGIZINKAN, tidak pernah
menjawab "peran orang ini apa". Untuk yang kedua, baca `private.peran_saya()`.

Yang tetap tertutup bagi semua orang tanpa memandang peran: pembekuan isi PO
yang sudah ditandatangani, dan syarat empat lampu hijau sebelum terverifikasi.
Keduanya trigger. Karena Super Admin bisa memberi peran kepada dirinya sendiri,
setiap perubahan peran tercatat di `pengguna_riwayat` — tabel tanpa kebijakan
tulis, diisi trigger, tidak bisa dihapus siapa pun termasuk Super Admin.

**Nilai bukan-komponen tidak diimpor komponen server dari modul `'use client'`.**
Next.js menukarnya dengan rujukan klien, jadi nilainya `undefined` di server
tanpa galat apa pun. Dijaga oleh `uji/batas-klien.test.mjs`.

**Penutupan verifikasi otomatis dikerjakan basis data, bukan aplikasi.** Verdict IoM yang
lolos menutup PO-nya di transaksi yang sama (`private.tutup_otomatis`, dipicu trigger
`po_tutup_otomatis`), berikut menerbitkan dan mengunci Surat Verifikasi Kesiapan. Jalur
IoM-nya dijaga penanda transaksi `app.penutup_iom` yang hanya dipasang fungsi itu — bukan
peran, dan bukan kolom yang bisa ditulis klien. Bila penutupannya gagal, SELURUH pengajuan
verifikasi Sales ikut batal: gagal keras, bukan diam, supaya tidak ada PO yang lolos tetapi
menggantung tanpa bisa ditutup siapa pun. `buat_pks` sengaja tidak diubah — ia tetap
menuntut surat final, dan surat itu kini final sejak terbit.

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3000
npm run periksa    # tsc --noEmit lalu seluruh uji
npm run uji        # uji saja
```

Perkakas pemeriksaan manual yang tidak ikut `npm run uji`, karena butuh mata
atau peramban: `uji/pratinjau-pks.mjs` (paginasi PKS), `uji/pratinjau-dasbor.tsx`
(dasbor terang dan gelap), `uji/pratinjau-sekolah.tsx` (riwayat sekolah),
`uji/pratinjau-ponsel.mjs` (tata letak ponsel). Hasilnya bisa dipotret dengan
`node uji/tangkap-layar.mjs <berkas>.html` — dua bug tata letak lolos ke
produksi sebelum perkakas ini ada.

## Environment variable

| Nama | Isi |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL proyek Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Kunci publik Supabase |
| `NEXT_PUBLIC_DOMAIN_WAJIB` | Default `skolla.education` |

`vercel link` menimpa `.env.local`. Salin dulu sebelum menjalankannya.

## Yang masih perlu diberesi

- **Supabase masih di paket gratis, dan sekarang tiga hal menumpuk di situ.**
  Pertama, langit-langit penyimpanan: pindaian PKS bermeterai boleh sampai
  15 MB, dan dengan belasan sales itu berkisar satu setengah gigabita setahun.
  Kedua, proyek dev tidak bisa dibuat — batasnya dua proyek aktif per admin dan
  keduanya sudah terpakai. Ketiga, Pro membuka branch basis data, yang untuk
  percobaan skema lebih baik daripada proyek dev terpisah.
- Peran uji pada akun `rizki@skolla.education` perlu dicabut sebelum dipakai
  sungguhan; delapan peran sekaligus dipasang untuk menguji alur.
- Halaman Analytics menarik seluruh baris PO ke memori lalu menghitung di JS.
  Ratusan baris masih nyaman; begitu menembus ribuan, agregasinya perlu
  didorong ke basis data.
- Kebijakan retensi data pribadi: usulannya di `catatan/retensi-data-pribadi.md`,
  menunggu keputusan. Belum ada penghapusan otomatis, dan sengaja begitu.
#pks-generator-skolla
