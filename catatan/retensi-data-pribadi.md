# Register retensi data pribadi

Status: **diputuskan Rizki 9 Sep 2026.** Mekanismenya belum dibangun; kebijakannya
sudah. Penghapusan tetap tidak otomatis, dan itu bagian dari keputusannya.

Disusun 2026-08-30 sebagai bagian diagnostik menyeluruh. Ini penahan peluncuran
yang tersisa: sistem menyimpan data pribadi dan sampai sekarang tidak pernah
menghapus apa pun.

## Apa yang tersimpan

| Jenis | Tempat | Isi | Sekarang |
|---|---|---|---|
| Tanda tangan PO | bucket `tanda-tangan`, `<po_id>/<pihak>.png` | Goresan tanda tangan kepala sekolah, Partnership Manager, Sales Manager | 3 berkas, 84 kB |
| Tanda tangan surat | bucket `tanda-tangan`, `surat/<po_id>.png` | Goresan tanda tangan Tech Ops Lead | 1 berkas, 39 kB |
| Pindaian PKS bermeterai | bucket `pks-basah`, `<po_id>/pks.<ext>` | Dokumen lengkap berikut tanda tangan basah dan meterai kedua pihak | belum ada |
| Identitas mitra | tabel `sekolah` dan kolom `po.sekolah_beku` | Nama dan nomor HP kepala sekolah serta bendahara | 1 sekolah |
| Identitas pengguna | tabel `pengguna` | Alamat surel dan nama karyawan Skolla | 4 baris |
| Pindaian PO unggahan | bucket `po-unggahan`, `<po_id>/po.pdf` | Form PO lengkap berikut tanda tangan ketiga pihak | belum ada, lihat `08` |
| Komentar PO | tabel `po_komentar` | Teks bebas; bisa memuat nama, nomor HP, dan alasan sensitif | tabel berdiri 10 Sep, 0 baris |
| Penulis komentar | kolom `po_komentar.nama_penulis`, `peran_penulis` | Salinan nama dan peran karyawan saat menulis — sengaja beku, seperti `po.sekolah_beku` | 0 baris |
| Waktu baca komentar | tabel `po_komentar_dibaca` | Kapan tiap karyawan terakhir membuka komentar sebuah PO; hanya terbaca pemiliknya sendiri | 0 baris |

Tanda tangan adalah data pribadi menurut UU 27/2022 tentang Pelindungan Data
Pribadi. Nomor HP kepala sekolah dan bendahara juga.

## Usulan masa simpan

**1. Tanda tangan PO dan tanda tangan surat — 12 bulan setelah PKS
ditandatangani basah, atau 12 bulan sejak PO terakhir disentuh bila tidak
pernah sampai PKS.**

Alasannya: begitu PKS bermeterai terunggah, dokumen itulah yang mengikat. PO
dan Surat Verifikasi Kesiapan turun jadi jejak proses internal, dan goresan
tanda tangannya tidak lagi punya fungsi hukum. Barisnya di tabel `tanda_tangan`
dan `surat_verifikasi` tetap disimpan — nama, waktu, dan siapa membubuhkan —
jadi jejak audit "siapa mengerjakan apa" tidak putus. Yang dihapus hanya
gambarnya.

**2. Pindaian PKS bermeterai — masa berlaku kerja sama + 10 tahun.**

Ini bukan jejak proses melainkan dokumen perusahaan. UU 8/1997 tentang Dokumen
Perusahaan mewajibkan dokumen keuangan disimpan 10 tahun. Praktisnya: jangan
dihapus, dan jangan dibuatkan tombol hapus. Yang perlu ditetapkan justru
sebaliknya — ke mana ia dipindahkan kalau kelak arsipnya dipisah dari sistem
yang aktif.

**3. Nomor HP kepala sekolah dan bendahara — mengikuti PO-nya.**

Tersimpan dua kali: di `sekolah` (hidup, dipakai bersama) dan di
`po.sekolah_beku` (beku, dicetak di dokumen). Salinan bekunya ikut umur PO;
baris hidupnya bertahan selama sekolah itu masih mitra.

**4. Tabel `pengguna` — akun tidak pernah dihapus, hanya dinonaktifkan.**

Sudah begitu sekarang dan memang disengaja: PO, tanda tangan, dan keputusan
verifikasi merujuk ke alamat surel, jadi menghapusnya memutus jejak. Yang perlu
diputuskan hanya apakah alamat karyawan yang sudah keluar disamarkan setelah
sekian lama.

**5. Pindaian PO unggahan — jangan dihapus.** Diputuskan 9 Sep 2026.

Diperlakukan sebagai dokumen perusahaan, bukan jejak proses, dan karena itu mengikuti
aturan pindaian PKS bermeterai — bukan aturan gambar tanda tangan.

Alasannya sebuah asimetri: usulan 12 bulan untuk gambar tanda tangan berpijak pada
kenyataan bahwa PO bisa dibangun ulang dari data begitu PKS terbit. **Untuk PO unggahan
itu tidak berlaku** — pindaiannya adalah satu-satunya dokumen PO yang pernah ada, dan
data di sistem hanya transkripsi Sales darinya. Menghapusnya berarti membuang satu-satunya
bukti apa yang benar-benar ditandatangani sekolah.

**6. Komentar PO — mengikuti umur PO-nya, bukan aturan tersendiri.**

Komentar adalah bagian catatan PO. Yang perlu diingat: isinya teks bebas, jadi data
pribadi bisa masuk ke sana tanpa kolom khusus yang menandainya — tidak ada cara otomatis
menemukannya kembali. Itu alasan tambahan kenapa utasnya tidak boleh jadi tempat menulis
hal yang tidak pantas tersimpan lama.

## Keputusan (9 Sep 2026)

**1. Gambar tanda tangan: 12 bulan**, sesuai usulan di atas. Barisnya di tabel tetap
disimpan — nama, waktu, siapa membubuhkan — yang dihapus hanya gambarnya.

Perlu disadari sebagai konsekuensi yang disengaja: tanda tangan yang dibubuhkan lewat
platform dihapus setelah 12 bulan, sementara tanda tangan yang sama pada PO unggahan
tersimpan **selamanya**, karena ia ada di dalam pindaian yang tidak boleh dihapus.
Alasannya sah — pindaian itu satu-satunya dokumen yang tidak bisa dibangun ulang — tapi
ini tetap perlakuan berbeda atas data pribadi sejenis, dan dipilih sadar, bukan luput.

**2. Penghapusan dijalankan Super Admin, manual, dari daftar jatuh tempo.** Sistem
mendaftar berkas yang sudah lewat masanya; orang yang menekan tombolnya. Bukan cron:
penghapusan tidak bisa dibatalkan, jadi harus selalu ada yang bertanggung jawab.

**3. Sekolah diberi tahu, di Form Pre-Order DAN di PKS.** Kalimat ringkas saat data
dikumpulkan, pasal lebih lengkap di perjanjiannya.

Dua konsekuensi yang mengikat:

- Bunyi kalimatnya **harus ditinjau orang legal**. Ini kewajiban UU PDP, bukan salinan
  teks yang boleh dikarang sendiri.
- Masa simpannya hidup sebagai **satu konstanta** yang dipakai kedua dokumen. Kalau
  diketik dua kali, keduanya akan menyimpang saat kebijakannya berubah — dan yang
  tercetak di dokumen bermeterai adalah yang salah.
- **PO unggahan perlu penanganan tersendiri**: kertasnya dicetak Sales sendiri dan bisa
  templat lama tanpa kalimat itu, jadi Sales mencentang konfirmasi bahwa pemberitahuan
  sudah disampaikan.

**4. Pindaian PKS tetap di Supabase Storage, tidak dipindah ke mana-mana.**

Konsekuensinya penyimpanan hanya bertambah dan tidak pernah menyusut, sementara paket
Supabase masih free tier. Ini menambah satu alasan lagi untuk naik ke Pro — yang sudah
lama tercatat sebagai kebutuhan.

## Kenapa belum ada cron

Periodenya sekarang sudah disepakati, tapi jawabannya tetap **bukan cron** — itu
keputusan nomor 2 di atas, bukan penundaan. Menghapus berkas tanda tangan tidak bisa
dibatalkan; kalau perhitungan jatuh temponya keliru, berkasnya hilang sebelum ada yang
sadar dan tidak ada yang bisa dimintai keterangan.

Keduanya sudah berdiri sejak 9 Sep 2026: `daftar_jatuh_tempo()` dan halaman `/retensi`
untuk Super Admin, dengan konfirmasi per baris — bukan tombol borongan.
