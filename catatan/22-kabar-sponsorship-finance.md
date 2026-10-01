# Keputusan: Kabar sponsorship — peringatan dini dan antrean Finance

Status: **DIBANGUN 22 Sep 2026**. Melengkapi `catatan/18` bagian "Dokumen sponsorship di tahap
PKS". Tidak mengubah aturan IoM, tidak menyentuh basis data.

## Masalah

Gerbangnya sudah ada dan keras: `unggah_pks_basah` menolak PKS bertanda tangan basah selama
Finance belum mengonfirmasi dokumen sponsorship untuk versi PO yang berlaku
(`20260920c_dokumen_sponsorship_pks.sql`). Yang kurang dua.

Pertama, **Sales baru tahu di langkah terakhir**. Kotak konfirmasinya hanya ada di halaman PKS,
sementara Sales berjalan dari Form PO: membuat PO, menandatangani, menunggu verifikasi, menyusun
PKS, mencetak dua rangkap, menandatangani basah di atas meterai. Ia menemukan dindingnya saat
mengunggah pindaian — dengan kertas yang sudah ditandatangani di tangan.

Kedua, **Finance tidak punya tempat yang memberi tahu**. Halaman PKS menampilkan semua PO
terverifikasi tanpa membedakan mana yang menunggu tindakannya.

## Keputusan (Rizki, 22 Sep 2026)

| Hal | Keputusan |
|---|---|
| Lokasi kabar Finance | **Bagian di halaman PKS**, hanya terlihat Finance |
| Lencana menu | **Tidak ada.** Cukup bagian di halamannya |
| Pemicu | **PKS difinalisasi** (`po.status = 'pks_terbit'`) |
| Saluran | **Dalam aplikasi saja.** Tidak ada surel |
| Peringatan untuk Sales | Dua tempat: langkah Penanda di wizard, dan halaman PO pada status terkunci |

## Kenapa pemicunya finalisasi, bukan penyusunan draf

Pada saat PKS difinalisasi, Sales berikutnya mencetak, menandatangani basah, lalu tertahan di
unggah. Itu titik di mana konfirmasi Finance benar-benar dibutuhkan, dan masih ada waktu bagi
Finance untuk mengerjakannya.

Draf yang belum difinalisasi bisa dibatalkan, jadi mengabarkannya berisiko mengirim Finance ke
pekerjaan yang tidak jadi. PO yang belum terverifikasi bahkan belum boleh punya PKS sama sekali.

Konsekuensi yang disadari: **kalau Sales tidak pernah memfinalisasi PKS-nya, PO itu tidak
muncul di antrean Finance** — padahal Sales mungkin sudah butuh konfirmasinya. Tidak ada yang
hilang permanen, karena kotak konfirmasinya tetap tampil di halaman PKS sejak draf dibuat; yang
tidak ada hanyalah dorongannya.

## Kenapa tidak ada surel

Repo ini tidak punya jalur keluar sama sekali, dan itu keputusan lama
(`catatan/09-spesifikasi-komentar-po.md`, keputusan #4; ditegaskan lagi di `catatan/20`). Pola
"menerima kabar" yang sudah dipakai adalah bagian di halaman: Head of Operations dan Tech Ops
Lead menerima kabar penutupan otomatis lewat bagian "Terverifikasi otomatis IoM" di Antrean
Verifikasi, tanpa lencana dan tanpa penanda "sudah dibaca". Bagian Finance ini mengikuti pola
yang sama, bukan membuat jalur kedua.

## Kenapa tidak ada migrasi

Yang ditambah hanya cara memberi tahu; yang menolak sudah ada. Tidak ada tabel baru, RPC baru,
kebijakan RLS baru, dan tidak ada berkas di `supabase/migrasi/` maupun `supabase/migrations/`
yang disentuh. Daftar tunggunya **dihitung dari data yang sudah ada**:

> PO berstatus `pks_terbit` yang bersponsorship dan belum punya konfirmasi yang berlaku untuk
> `po.versi` sekarang.

Bacanya RLS yang menentukan: peran Finance termasuk yang `boleh_lihat_po`, dan
`pks_dokumen_sponsorship` boleh dibaca siapa pun yang boleh melihat PO-nya.

## Satu tempat untuk dua syarat

Syaratnya kini dipakai empat tempat — kotak konfirmasi dan kotak unggah di halaman PKS,
peringatan Sales di halaman PO, dan antrean Finance di daftar PKS — sementara mesin yang
menolak ada di basis data. Salinan yang melenceng tidak memunculkan galat: yang terjadi
hanyalah PO yang hilang dari antrean, atau kotak yang mengaku "sudah dikonfirmasi" sementara
unggahannya tetap ditolak. Karena itu keduanya tinggal di `lib/sponsorship.ts`, dan komponen
kotak konfirmasi pun memakainya — bukan menyalin syaratnya sendiri:

- `adaSponsorship(po)` — cerminan `v_sponsor` di `public.unggah_pks_basah`: ada catatan
  sponsorship berisi **atau** nilainya diisi. PO lama tanpa nilai tetap bersponsorship.
- `konfirmasiBeres(konfirmasi, versiPo)` — ketiga centang **dan** `versi_po` sama dengan versi PO
  sekarang. Yang kedua yang paling mudah terlupa: PO yang direvisi harus dikonfirmasi ulang.

Dijaga `uji/sponsorship-beres.test.mjs`.

## Temuan QA independen, 22 Sep 2026

QA yang membaca ulang perubahan ini tanpa diberi tahu alasan di baliknya menemukan dua hal
yang tidak tertangkap `npm run periksa`:

1. **Refactor belum tuntas.** Komponen kotak konfirmasi masih menyalin ketiga centang dan
   syarat versinya sendiri, sementara komentar di `lib/sponsorship.ts` sudah mengaku
   sebaliknya. Akibatnya bisa terjadi perpecahan diam-diam: pintu unggah bilang tertahan
   (karena memakai helper) sementara lencana di halaman yang sama bilang "Sudah dikonfirmasi"
   (karena memakai salinannya). Sekarang komponen itu memakai `konfirmasiBeres`; `berlaku`
   tetap dipisah hanya karena pesannya berbeda — "versi lama" bukan "belum lengkap".
2. **`adaSponsorship` bukan cerminan persis gerbangnya.** Semula `isi.trim()` dipakai,
   sedangkan basis data memakai `btrim(coalesce(isi, ''))`. `trim()` JavaScript membuang tab,
   baris baru, dan spasi tak-terpisah; `btrim` Postgres hanya membuang spasi. Catatan berisi
   tab saja karena itu terbaca kosong oleh aplikasi tetapi **tidak** kosong bagi basis data —
   PO yang pasti ditolak saat diunggah justru hilang dari antrean Finance, dan peringatan
   Sales ikut diam. Sekarang yang dipakai "apakah masih ada karakter selain spasi".

Keduanya hanya terjangkau lewat PO lama yang ditulis langsung lewat PostgREST: jalur UI
menulis `isi` yang sudah di-trim, dan `private.jaga_syarat_maju` menuntut catatan berpasangan
dengan nilai. Tetap diperbaiki, karena yang dijaga di sini justru ketidakcocokan yang tidak
bersuara.

3. **Lencana peringatan pertamanya terpotong di 375px.** Kalimat lengkapnya
   ("Dokumen sponsorship perlu dikonfirmasi Finance sebelum PKS bermeterai bisa diunggah.")
   82 karakter, sedangkan `.lencana` tidak bisa membungkus dan `.kotak` memotong luberannya.
   Ketahuan begitu dipotret di lebar 375, bukan dari uji. Dipendekkan jadi 45 karakter —
   terukur, teksnya 263px di dalam pil 301px. Kelas `.pesan.kuning` juga baru dipakai di sini;
   sebelum ini ia sempat menganggur.

Batas ketiga ditambahkan ke uji sebagai akibat temuan di atas: tab/baris baru/spasi
tak-terpisah, `po_catatan` dengan lebih dari satu baris (PK-nya `(po_id, jenis)`, jadi
'pelaksanaan' dan 'sponsorship' bisa berdampingan, dan urutan embeds tidak dijamin), dan
konfirmasi untuk versi PO yang lebih baru — semuanya sempat lolos tanpa suara.

Satu hal yang **tidak** diperbaiki karena sudah ada sebelumnya: lencana batas 15%
("Di atas 15% dari total. PO ini akan diverifikasi manual.", 56 karakter) hanya menyisakan 6px
di 375px, dan teksnya melampaui tepi pilnya sekitar 4px. Kosmetik, dan bukan akibat perubahan
ini.

## Layar

- **Wizard, langkah Penanda tangan & catatan** (Sales): begitu nilai atau catatan sponsorship
  diisi, muncul lencana kuning "Perlu konfirmasi Finance sebelum PKS diunggah." Berdampingan
  dengan lencana batas 15% yang sudah ada. Dinyalakan oleh nilai **atau** catatan, bukan
  keduanya: Sales sedang mengetik, dan peringatannya justru paling berguna sebelum barisnya
  lengkap. Ini peringatan, bukan halangan simpan — draf boleh setengah jadi.
  **Teksnya sengaja pendek:** `.lencana` itu `white-space:nowrap` dan `.kotak` `overflow:hidden`,
  jadi kalimat yang lebih panjang dari ini terpotong di 375px, bukan membungkus. Kalimat
  lengkapnya ada di halaman PO. Dijaga `uji/pratinjau-sponsorship.mjs`, yang kini memuat kedua
  lencana sekaligus — keadaan "dua lencana menumpuk" itulah yang paling rawan.
- **Halaman PO** (Sales dan yang lain): pemberitahuan sponsorship pada status yang terkunci,
  dengan tautan ke halaman PKS-nya. Digerbangi status terkunci supaya tidak berdobel dengan
  catatan di langkah Penanda.
- **Daftar PKS** (Finance saja): bagian **"Menunggu konfirmasi dokumen"** di atas "Siap
  disusun", berisi PO, sekolah, jumlah siswa, dan nilai, dengan tombol menuju PKS-nya. Bagian
  ini tidak dirender sama sekali bagi peran lain — bukan sekadar tombol yang dimatikan.

Perannya **harfiah**: `peran_saya()` memuat `finance`, sama dengan kebijakan RLS-nya. Super Admin
yang tidak memegang peran `finance` tidak melihat bagian ini dan tidak bisa mengonfirmasi —
butir ini milik Finance, bukan milik siapa saja yang berwenang.

## Yang perlu diperhatikan saat menulis teksnya

Konfirmasi Finance adalah **pernyataan** bahwa Form Sponsorship/Hibah beserta Berita Acaranya
sudah ditandatangani. Sistem tidak menerbitkan dan tidak memeriksa dokumen itu; templatnya masih
pekerjaan terpisah dan masih tercatat menahan peluncuran
(`catatan/19-rencana-nilai-sponsorship.md`, `catatan/05-penahan-peluncuran.md`). Teksnya tidak
boleh menyiratkan sebaliknya.
