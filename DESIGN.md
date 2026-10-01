# DESIGN.md — Sistem Kerjasama Skolla

Arah desain untuk aplikasi ini. Sumbernya Skolla Brand Guideline (Google Slides
milik tatang@skolla.education) ditambah keputusan yang sudah hidup di
`app/globals.css`. Token di `globals.css` adalah sumber kebenaran angka; berkas
ini mencatat alasannya.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1 (dikonfirmasi pemilik 2026-09-12: alat kerja internal yang dibuka berkali-kali sehari)

## Identitas

- Alat kerja internal Skolla untuk alur kerja sama sekolah: kalkulator, PO,
  tanda tangan, verifikasi, Surat Verifikasi Kesiapan, PKS. Dipakai Sales,
  verifikator, Finance, dan pimpinan, berkali-kali sehari.
- Kepribadian: tenang, tepercaya, padat informasi. Angka, status, dan siapa
  yang menahan apa harus terbaca sekilas. Tidak ada yang berebut perhatian
  dengan data.
- Bukan halaman pemasaran: tanpa hero, tanpa ilustrasi dekoratif, tanpa
  animasi masuk. Logo Skolla tidak pernah digambar ulang atau dimodifikasi.

## Palet

| Peran | Terang | Gelap |
|---|---|---|
| Latar (`--bg`) | Gray 50 `#F0F3F9` | NDB 90% `#000226` |
| Permukaan (`--surface`) | Full White `#FFFFFF` | NDB 80% `#010339` |
| Teks (`--ink`) | Gray 900 `#2D3643` | `#F0F3F9` |
| Teks sekunder (`--muted`) | Gray 700 `#455468` | Gray 400 `#AFBACA` |
| Primary (garis, fokus) | Rich Electric Blue `#0E97D6` | REB 40% `#5EBAE4` |
| Teks primary (`--primary-ink`) | REB 70% `#09658F` | REB 30% `#87CBEB` |
| Bidang terisi (`--primary-fill`) | REB 70% `#09658F` | REB 40% `#5EBAE4` |
| Secondary | Neon Dark Blue `#010571` | `#82A5FF` |
| Aksen | Golden Corn `#F2CA17` | `#F2CA17` |
| Bahaya | Error 700 `#B42318` | `#FDA29B` |

- Teks putih TIDAK PERNAH di atas `#0E97D6` (3,27:1, gagal AA). Bidang terisi
  berteks putih memakai `#09658F` (6,4:1), masih di dalam ramp merek.
- Teks sekunder Gray 700, bukan Gray 600 (`#5E718D` hanya 4,47:1 di atas Gray 50).
- Golden Corn tidak boleh terlihat dominan: sorotan kecil saja, bukan bidang besar.
- Warna status PO (`--st-*`) dipisah per tema; tiap warna lolos 3:1 di temanya
  sendiri. Satu nilai untuk kedua tema tidak mungkin lolos.
- Mode gelap diturunkan dari ramp Neon Dark Blue; panduan merek tidak mengaturnya.

## Tipografi

- Rubik satu-satunya font antarmuka. Sora (alternatif opsional di panduan) tidak dimuat.
- Judul Rubik Bold, letter-spacing −2%, `clamp(25px, 3.4vw, 34px)`.
- Isi 15px, line-height 1.6. Label/CTA Rubik SemiBold.
- Eyebrow 11px huruf kapital, SemiBold, warna `--primary-ink`, tracking .13em.
  Sengaja lebih renggang dari label tabel dan formulir (.04-.07em): eyebrow
  penanda konteks di atas judul, satu per layar, jadi boleh lebih lantang dari
  label data. Label data tetap rapat supaya tidak bersaing dengan angkanya.
- Angka selalu `tabular-nums`.
- Rata kiri. Hindari rata kanan dan rata kanan-kiri.
- Paragraf tidak dibatasi lebarnya secara bawaan; yang butuh kolom sempit memakai `.prosa`.

## Bentuk dan ruang

- Radius `--r` 10px untuk panel, kartu, dan tombol. 999px hanya untuk chip
  status, pill, pengalih tema, dan tombol keluar.
- Satu bayangan (`--shadow`) dan satu tingkat elevasi: panel dan kartu duduk
  di atas latar abu Gray 50 sebagai permukaan kerja; latar itu lantainya.
  Tidak ada tingkat kedua dan tidak ada bayangan berlapis-lapis.
- Garis kiri 4px hanya pada kotak yang menandai keadaan: `.galat`,
  `.halangan`, `.pesan.buruk` (galat) dan `.pesan.baik` (berhasil). Garis itu
  tetap terbaca saat latar tint tak terlihat (layar silau, cetak abu-abu, buta
  warna), jadi keadaannya tidak bergantung pada warna latar saja. Kartu dan
  panel biasa tidak memakai garis tepi berwarna.
- Lebar isi maksimal 1100px.
- Di layar ≤520px semua target sentuh minimal 44px.

## Tema

- Dua posisi saja: Terang dan Gelap. Tidak ada opsi "Sistem".
- Bawaan TERANG dan tidak mengikuti setelan sistem. Gelap hanya lewat
  `[data-theme="dark"]`; tidak ada blok `prefers-color-scheme`.

## Dokumen resmi (PO, Surat Verifikasi, PKS)

- Hitam-putih: diteken, difotokopi, dipindai. Warna merek tidak masuk dokumen.
- PKS memakai Times New Roman 12pt dan kop gambar A4 penuh (`public/kop-pks.png`).
  Surat Verifikasi Kesiapan TIDAK berkop.
- Aturan layar sempit selalu `@media screen and (...)`; tanpa `screen` ia ikut
  berlaku saat mencetak (A4 = 794px).
- Pratinjau A4 duduk di luar `.grid-po`.

## Suasana

Rujukan rasa: Linear dan GOV.UK. Fungsional, jujur, tanpa hiasan yang tidak
melayani keterbacaan.
