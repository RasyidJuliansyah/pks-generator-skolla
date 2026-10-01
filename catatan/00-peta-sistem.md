# Peta Sistem Kerjasama Skolla

Sistem internal yang mengantar satu kerjasama sekolah dari penawaran sampai
perjanjian bermeterai. Menggantikan alur manual berbasis Google Docs.

- Repo: `rizki-skolla/skolla-kerjasama` (privat)
- Produksi: https://skolla-kerjasama.vercel.app (Vercel, tim Product Operations)
- Basis data: Supabase `lzamazdfaidxuohhzpjd`
- Tumpukan: Next.js 15 App Router, TypeScript, `@supabase/ssr`

## Alur utama

1. **PO dibuat** oleh Sales lewat kalkulator harga. Status `draf`.
2. **Tanda tangan digital** tiga pihak: Kepala Sekolah, Partnership Manager,
   Sales Manager. Status `menunggu_ttd` lalu `ditandatangani`.
3. **Verifikasi** lewat salah satu dari DUA jalur (sejak 22 Sep 2026, `catatan/13a`
   Bagian 11):
   - **Otomatis** — kalau PO memenuhi seluruh aturan IoM yang bisa diperiksa mesin,
     basis data menutupnya sendiri dan menerbitkan suratnya. Status langsung
     `terverifikasi`, tanpa langkah manusia. Head of Operations dan Tech Ops Lead
     menerima kabarnya di Antrean Verifikasi.
   - **Manual** — kalau PO menyimpang (a la carte, diskon, sponsorship di atas 15%,
     ada permintaan tambahan, unggahan, atau PO lama tanpa stempel), keempat fungsi
     berjalan paralel: Education, Tech Ops, Finance, Service Account. Status
     `verifikasi`, lalu **Tech Ops Lead menutupnya** menjadi `terverifikasi` atau
     `ditolak`.
4. **Surat Verifikasi Kesiapan** terbit. Pada jalur manual Tech Ops Lead
   menandatangani lalu memfinalisasinya; pada jalur otomatis suratnya terbit dan
   terkunci sendiri, menyatakan sistem yang mengkonfirmasi menurut ketentuan IoM
   yang berlaku. Status `pks_terbit`.
5. **PKS disusun** Sales, difinalisasi, diunduh sebagai PDF terkunci.
6. **PKS bermeterai diunggah** setelah tanda tangan basah. Status `pks_ditandatangani`.
7. Sisa yang belum tersambung: `aktif` dan `selesai`.

## Menu

`/beranda` Dashboard · `/analitik` Analytics · `/po` Daftar PO ·
`/verifikasi` Antrean Verifikasi · `/surat` Penerbitan Surat ·
`/pks` Perjanjian (PKS) · `/pengguna` Kelola Pengguna

Daftar PO berhenti di `terverifikasi`; sejak PKS terbit, PO pindah ke menu PKS.

## Dokumen yang dihasilkan

- [[Form Pre Order]] — 3 halaman A4
- [[Surat Verifikasi Kesiapan]] — 1 halaman, tanpa kop
- [[Perjanjian Kerja Sama]] — 14 pasal, berkop, PDF terkunci

Rinciannya di [[Dokumen dan Templat]]. Keputusan arsitektur di
[[Keputusan Arsitektur]]. Bug yang pernah menggigit di [[Jebakan dan Bug]].
