# Spesifikasi: Ekstraksi scan PO unggahan (sub-proyek 2)

Status: **dirancang dan disetujui Rizki 17 Sep 2026, diamandemen 25 Sep 2026 (penanda "dibaca AI"; cara Sales mengonfirmasi; baca dulu simpan sesudahnya; lihat bagian akhir), DIBANGUN 25 Sep 2026 (catatan/25 Tugas 1-10), TAYANG 25 Sep 2026 dengan gerbang MATI (migrasi 20260926* + deploy produksi; model `deepseek-v4.1-flash`). Gerbang baru boleh dinyalakan sesudah tiga syarat di "Sebelum gerbang dinyalakan".** Sub-proyek pertama
(wizard) ada di `catatan/11`. Latar belakang, prinsip, dan keputusan 9 dan 14 Sep ada di
`catatan/08`, bagian "Ekstraksi"; berkas ini menggantikan bagian yang bertentangan di sana
(penyedia dan isi gerbang organisasi).

## Tujuan

Pada jalur unggah, isian wizard terisi dari hasil baca scan oleh model AI, dan Sales tinggal
memeriksa, mengoreksi, dan melengkapi. **Yang tersimpan hanya yang dikonfirmasi Sales**
(`catatan/08`, "hasil tangkap adalah alat bantu ketik"). Ekstraksi tidak pernah wajib: tanpa
gerbang terbuka, tanpa centang, atau bila pembacaan gagal, Sales mengetik seperti hari ini.

## Bukti yang menjadi dasar (uji 16 dan 17 Sep 2026)

- **Tahap 1**, Form PO rekaan yang diketik, dihasilkan dari sistem: 34/34 isian benar.
- **Tahap 2**, dua PO asli bertulisan tangan (SMA Advent Bogor, SMA Ar-Rahman Depok), dikirim
  atas keputusan eksplisit Rizki: **66/71 isian (93%)** benar sesudah isian yang diperdebatkan
  dicek ulang pada potongan scan yang diperbesar. Waktu 16,6 dan 34,3 detik; token masuk 2.665,
  keluar 2.257 dan 6.418.
- **Yang dibaca sempurna:** nomor rekening, harga, total, sel rombel, grand total di sel gelap,
  tabel termin yang berantakan (termasuk isian di kolom yang salah), kotak centang jenjang,
  sumber dana, dan paket, serta sebagian besar catatan halaman 2. Model menandai sendiri
  tanggal selesai yang mendahului tanggal mulai dan tahun yang ditebak.
- **Yang gagal:**
  - satu digit salah di kedua nomor HP Ar-Rahman, **tanpa ditandai ragu**;
  - "PM OFFLINE" terbaca "PTA ONLINE" (ditandai ragu);
  - nama PM tulisan tangan salah eja.
- **Batas bukti:** dua PO dari penulis yang sedikit. Karena itu uji 5 sampai 10 PO rekaan
  tulisan tangan dari penulis berbeda menjadi syarat menyalakan gerbang (lihat "Sebelum
  gerbang dinyalakan"), bukan syarat membangun.

Seluruh berkas uji yang memuat data pribadi sudah dihapus 17 Sep 2026.

## Keputusan (Rizki, 17 Sep 2026)

| Hal | Keputusan |
|---|---|
| Penyedia | **DeepSeek V4.1 Flash (`deepseek-v4.1-flash`) lewat OpenCode Go.** Semula `deepseek-v4-flash-vision-exp`; diganti Rizki 25 Sep 2026 sebelum rilis karena akhiran `-exp` = model eksperimental. Akurasi 93% di uji 17 Sep diukur pada model LAMA; model baru belum diukur di Form PO tulisan tangan |
| DPA | **Tidak ada.** Keputusan 9 Sep (pemrosesan luar negeri hanya DENGAN DPA, sebagai gerbang) dibatalkan untuk ekstraksi; gerbang organisasi mencatat siapa yang menerima risikonya dan alasannya |
| Kotak paket di kertas | Hanya kotak yang jelas yang mengisi komponen: LMS Lite, LMS Smart, LMS Juara, Asesmen Psikologi. TKA, UTBK, ANBK, dan Custom hanya tampil sebagai catatan |
| Lapis gerbang per unggahan | Centang wajib sekarang, tidak menunggu kalimat pemberitahuan disetujui legal |
| Waktu pembacaan | Di langkah 0; Sales menunggu |
| Hasil mentah AI | **Disimpan**, hanya terbaca Super Admin, masa simpan sama dengan scan PO (saat ini tidak dihapus, lihat "Data") |

**Risiko yang diterima dengan sadar:**

1. **Tanpa DPA.** Scan memuat nama, nomor HP, dan tanda tangan kepala sekolah serta bendahara,
   juga harga kesepakatan. Tidak ada kontrak pemrosesan data dengan penyedia. Dicatat di gerbang
   organisasi beserta nama penerima risiko.
2. **Paket OpenCode Go dijual untuk agen koding.** Bila syaratnya melarang pemakaian di aplikasi
   produksi, kunci bisa diputus. Dampaknya terbatas: unggah tetap berjalan dan Sales mengetik
   seperti hari ini. Pemanggilan penyedia dikurung dalam satu fungsi supaya penggantian penyedia
   cukup satu perubahan. Syaratnya diperiksa sebelum gerbang dinyalakan.

## Alur

1. **Langkah 0, jalur unggah.** Sales memilih PDF seperti hari ini. Di bawahnya ada kotak
   "Baca scan dengan AI", yang **hanya tampil bila gerbang organisasi menyala**:
   - centang wajib: "Sekolah sudah diberi tahu bahwa PO ini dibaca layanan AI.";
   - tombol "Baca scan", mati sampai dicentang.
   Tanpa menekan tombol, Sales lanjut mengetik seperti hari ini.
2. **Saat "Baca scan" ditekan:**
   1. sistem menyimpan draf kosong (`asal = 'unggahan'`) dan mengunggah scan ke `{id}/po.pdf`
      lewat kebijakan penyimpanan yang sudah ada (menuntut PO ada dan masih draf);
   2. peramban mengubah halaman PDF menjadi gambar dengan pdf.js (`pdfjs-dist`), karena model
      tidak membaca PDF dan merender di server berarti langkah Chromium yang berat. Gambar
      dikompres ke JPEG sehingga seluruh badan permintaan di bawah **1 MB**, batas badan Server
      Action di aplikasi ini (dicatat di `lib/pks-aksi.ts`); ukuran diuji;
   3. server action memanggil fungsi klaim (lihat "Perlindungan"), lalu mengirim gambar ke
      penyedia;
   4. Sales melihat pesan kemajuan (sekitar 30 detik).
3. **Hasil.** Wizard membuka langkah 1 dengan isian terisi. Bila gagal atau lewat batas waktu,
   Sales melihat "Scan tidak terbaca, lanjutkan dengan mengetik." Draf dan scan tetap ada.
4. **Satu pembacaan per PO**, ditegakkan basis data. Scan yang diganti sesudahnya tidak dibaca
   ulang. Super Admin bisa mengizinkan baca ulang dengan menghapus catatan pembacaan yang gagal.
5. **Draf dari percobaan yang ditinggalkan** tetap berupa draf biasa berisi scan, terlihat di
   daftar draf Sales, dan tunduk pada retensi scan PO yang sudah ada.

Gambar yang dikirim dirender di peramban, jadi secara teknis bisa berbeda dari PDF yang
tersimpan. Itu diterima: hasilnya hanya isian awal yang wajib dikonfirmasi Sales terhadap scan
yang tersimpan.

## Pemetaan ke wizard

| Langkah wizard | Diisi dari scan | Tidak diisi |
|---|---|---|
| 1 Sekolah | nama, NPSN, jenjang, alamat, telepon, email, kepala sekolah dan HP, bendahara dan HP | tautan ke data sekolah yang sudah ada: bila nama atau NPSN cocok, sistem menyarankan dan Sales memilih |
| 2 Paket & harga | komponen untuk kotak LMS Lite, LMS Smart, LMS Juara, atau Asesmen Psikologi yang dicentang (himpunan `ids` paket itu persis); harga per siswa dan per guru | komponen untuk TKA, UTBK, ANBK, Custom; harga berkelompok |
| 3 Rombel | tabel rombel (kelas, rombel, jumlah siswa) | |
| 4 Termin & masa aktif | termin (tanggal, nominal), tanggal mulai dan selesai, sumber dana | |
| 5 Penanda tangan & catatan | kota, tanggal tanda tangan, isi catatan | PM, Regional Head, dan Head of Sales (tetap dari daftar akun; Regional Head sejak `catatan/23`), **jenis setiap catatan** |

**Kotak paket.** Pemetaan mengikuti tabel deklarasi di `catatan/13a` Bagian 3, sehingga PO
unggahan yang paketnya jelas bisa lolos verifikasi otomatis bila isinya memenuhi aturan IoM.
Lebih dari satu kotak jelas yang dicentang: tidak ada komponen yang diisi, semua kotak tampil
sebagai catatan. Kotak lain dan teks Custom tampil di langkah 2, contoh: "Scan: UTBK dicentang,
Custom: PM OFFLINE". Bila `PRESET` atau `harga_paket` berubah, pemetaan dicek ulang (diuji).

**Aturan pengisian:**

1. **Jenis catatan selalu dipilih Sales.** Isinya diisi, jenis "pelaksanaan" atau "sponsorship"
   dikosongkan. Alasannya: sponsorship menuntut nilai dan diperiksa terhadap batas 15%
   (`catatan/18`); bila AI salah melabeli sponsorship sebagai pelaksanaan dan Sales
   melewatkannya, nilainya tidak pernah dituntut dan PO unggahan bisa lolos otomatis tanpa
   pemeriksaan batas maupun dokumen di tahap PKS. Sales tidak bisa maju sebelum setiap catatan
   berjenis.
2. **Setiap isian dari scan bertanda "dari scan, periksa"** sampai disentuh atau dikonfirmasi.
3. **Isian yang ditandai ragu oleh AI** mendapat tanda lebih kuat beserta alasannya.
4. **Setiap nomor HP wajib dicentang eksplisit**, ditandai ragu atau tidak.
5. **Tinjau tetap gerbang terakhir.** Pernyataan "data ini sesuai dengan pindaian" yang sudah ada
   tetap wajib, dan terkunci selama ada isian dari scan yang belum diperiksa atau catatan tanpa
   jenis.
6. **Nilai tidak sah dibuang, tidak ditebak:** tanggal yang tidak terurai, nominal bukan angka,
   jenjang di luar SD/SMP/SMA. Isiannya kosong dengan keterangan "tidak terbaca".
7. **Peringatan AI ditampilkan** di langkah yang bersangkutan (contoh: tanggal selesai sebelum
   mulai, tabel termin tidak rapi).
8. **Nilai sponsorship tidak pernah diisi dari scan** (`catatan/18`): Form PO kertas tidak punya
   isiannya. Bila catatan sponsorship terbaca, isian nilai ditandai "wajib diisi Sales".

Pemetaan hasil ke isian adalah fungsi murni (`lib/ekstraksi-po.ts`), tanpa impor nilai
pricelist, sehingga aman di peramban dan teruji.

## Data

Dua tabel baru. Migrasi dibuktikan dalam transaksi yang dibatalkan dan hanya diterapkan
sesudah Rizki menyetujui.

**`pengaturan_ekstraksi`**, satu baris per perubahan; baris terakhir yang berlaku:

| Kolom | Isi |
|---|---|
| `menyala` | boolean |
| `penyedia`, `paket_akun`, `model` | contoh: OpenCode, Go, `deepseek-v4.1-flash` |
| `pemeriksaan_data` | yang diperiksa tentang retensi dan pemakaian data untuk pelatihan, beserta sumbernya |
| `risiko_diterima_oleh`, `alasan_risiko` | wajib diisi saat `menyala` |
| `diubah_oleh`, `diubah_pada` | dari sesi, bukan dari isian |

Hanya Super Admin yang membaca dan menulis, dengan pemeriksaan peran harfiah
`'admin_utama' = any(private.peran_saya())`. Menyalakan tanpa kolom wajib ditolak basis data.

**`ekstraksi_po`**, satu baris per PO (`po_id` unik, inilah penegak satu pembacaan):

| Kolom | Isi |
|---|---|
| `po_id` | PO unggahan |
| `dicentang_oleh`, `dicentang_pada` | pernyataan pemberitahuan sekolah |
| `model` | dari konstanta di kode |
| `diklaim_pada`, `selesai_pada`, `durasi_ms`, `token_masuk`, `token_keluar` | |
| `berhasil`, `galat` | |
| `hasil` | jsonb, keluaran mentah model |

Hanya Super Admin yang membaca. Masa simpannya sama dengan scan PO. Pindaian PO unggahan
termasuk `TIDAK_DIHAPUS` di `lib/retensi.ts` (dokumen perusahaan, `catatan/retensi-data-pribadi.md`),
jadi dalam praktik hasil mentah juga **tidak pernah dihapus**. Paparannya tidak bertambah, karena
isinya adalah data yang sama dengan yang ada di scan. Bila kebijakan scan berubah, baris
`ekstraksi_po` PO itu ikut dihapus pada tindakan yang sama. (Diluruskan 25 Sep 2026: versi awal
menyiratkan penghapusan yang tidak pernah terjadi.)

Halaman Super Admin: bagian baru untuk gerbang (formulir dan riwayat), dan daftar pembacaan
(PO, siapa, kapan, berhasil, durasi) dengan hasil mentah yang bisa dibuka.

## Perlindungan

1. **Klaim sebelum kirim.** Fungsi `klaim_ekstraksi(p_po)` (security definer, EXECUTE dicabut
   dari PUBLIC dan anon, diberikan ke authenticated) menyisipkan baris `ekstraksi_po` hanya bila:
   - gerbang menyala;
   - pemanggil adalah pembuat PO;
   - PO berstatus draf, `asal = 'unggahan'`, dan scan sudah tersimpan;
   - belum ada baris untuk PO itu;
   - pemanggil membuat kurang dari 20 klaim hari ini (zona Asia/Jakarta).
   Server action baru memanggil penyedia sesudah klaim berhasil, sehingga tab kedua atau klik
   ganda tidak mengirim scan dua kali.
2. **Hasil ditulis sekali.** Fungsi `selesai_ekstraksi(p_po, ...)` hanya mengisi baris yang
   `selesai_pada`-nya masih kosong, oleh pengklaimnya, dalam 5 menit sesudah klaim.
3. **Batas yang diketahui.** Aplikasi tidak punya kunci service role; semua berjalan sebagai
   pengguna yang masuk. Sales yang sengaja memanggil `selesai_ekstraksi` lewat API bisa mengganti
   catatan pembacaannya sendiri satu kali dalam 5 menit itu. Yang terkena hanya salinan audit,
   bukan data PO yang tersimpan. Menutupnya berarti menambah kunci service role ke Vercel, kuasa
   yang terlalu luas untuk ini. Diterima.
4. **Kunci API** hanya di server, `OPENCODE_GO_API_KEY`, tidak pernah berawalan `NEXT_PUBLIC_`.
   `uji/pindai-bundel.mjs` diperluas: nama kunci dan host penyedia tidak boleh muncul di chunk
   klien. Model dipaku sebagai konstanta dan tercatat di setiap pembacaan.
5. **Tidak ada gambar yang disimpan** selain PDF scan yang sudah ada; gambar hanya hidup di
   memori permintaan.

## Kegagalan

- Batas waktu panggilan 60 detik (uji terlama 34 detik); `maxDuration` fungsi 90 detik.
- Lewat batas waktu, JSON tidak sah, galat penyedia, atau gerbang dimatikan di tengah jalan:
  dicatat `berhasil = false` dengan alasannya; Sales melanjutkan dengan mengetik.
- Tidak ada coba ulang otomatis.
- Hasil yang sah secara JSON tetapi tidak sesuai skema: bidang yang tidak sesuai dibuang satu
  per satu (aturan pengisian 6), bukan seluruh hasil.

## Uji

1. **Pemetaan hasil ke isian** (`uji/ekstraksi-po.test.mjs`), dengan berkas golden dari PO
   rekaan yang diketik, **tanpa data asli**:
   - keempat kotak paket jelas menghasilkan himpunan `ids` yang persis sama dengan
     `harga_paket`;
   - dua kotak jelas atau kotak lain: tanpa komponen, tampil sebagai catatan;
   - nilai tidak sah dibuang;
   - jenis catatan selalu kosong;
   - nomor HP selalu bertanda wajib dicentang;
   - tanda ragu dan peringatan diteruskan.
2. **Status langkah wizard:** Tinjau terkunci selama ada isian dari scan yang belum diperiksa
   atau catatan tanpa jenis.
3. **Bukti basis data dalam transaksi yang dibatalkan:**
   - gerbang mati: klaim ditolak;
   - bukan pembuat: ditolak;
   - PO platform atau bukan draf: ditolak;
   - klaim kedua: ditolak;
   - batas harian: ditolak;
   - hasil sesudah 5 menit atau oleh orang lain: ditolak;
   - menyalakan gerbang tanpa penerima risiko: ditolak;
   - Sales tidak bisa membaca kedua tabel;
   - EXECUTE tercabut dari PUBLIC.
4. **Pratinjau** tanda "dari scan, periksa", tanda ragu, centang HP, dan catatan paket di dua
   tema, lebar 1200 dan 375.
5. **Penyaring:** `npm run periksa`, build, `uji/pindai-bundel.mjs` yang diperluas, lalu QA
   independen sebelum deploy produksi.

**Tidak ada PO asli di berkas uji mana pun.** Uji panggilan penyedia sungguhan hanya dengan PO
rekaan, dan kuncinya dibaca dari lingkungan tanpa dicetak.

## Sebelum gerbang dinyalakan

Tidak menahan pembangunan, tetapi menahan tombol "menyala":

1. Syarat pemakaian OpenCode Go diperiksa untuk pemakaian di aplikasi produksi.
2. Tim mengisi 5 sampai 10 Form PO rekaan dengan tulisan tangan dari penulis berbeda; akurasinya
   diukur dengan skrip uji yang sama.
3. Kalimat pemberitahuan kepada sekolah (`catatan/10`) dikirim ke legal. Centang tetap berjalan
   tanpa menunggu hasilnya.

## Amandemen 25 Sep 2026: penanda "dibaca AI" setelah penutupan otomatis

**Yang berubah sejak spesifikasi ini disetujui.** Pada 17 Sep, PO yang lolos IoM masih ditutup
Head of Operations dengan satu klik. Sejak 22 Sep (`catatan/13a` Bagian 11) basis data
menutupnya sendiri dan menerbitkan suratnya, tanpa langkah manusia. Untuk PO unggahan yang
paketnya jelas, jalurnya kini: isian awal dari AI → Sales mengonfirmasi terhadap scan →
terverifikasi otomatis → PKS. Konfirmasi Sales menjadi satu-satunya pemeriksaan manusia atas
hasil baca AI.

**Keputusan (Rizki, 25 Sep 2026): PO hasil ekstraksi tetap boleh lolos otomatis, tetapi
bertanda.** Alasannya: konfirmasi Sales setara dengan Sales mengetik sendiri, yang juga lolos
otomatis; IoM tetap memeriksa setiap harga terhadap bottom price; nomor HP tetap wajib dicentang
satu per satu. Yang ditambahkan hanyalah jejak yang terlihat, supaya HoO dan Tech Ops Lead bisa
memeriksa acak sesudahnya.

**Penanda.** Kolom baru `po.dibaca_ai_pada timestamptz`, kosong secara bawaan.

- Diisi HANYA oleh `selesai_ekstraksi` saat hasilnya berhasil, dengan waktu `selesai_pada`.
  Pembacaan yang gagal tidak menandai PO: tidak ada isian yang diisi AI.
- Dijaga seperti `diverifikasi_otomatis`: `po_jaga_penanda` menolak perubahan dari klien kecuali
  setelan transaksi yang hanya dipasang fungsi security definer itu. Tanpa penjaga ini Sales
  bisa mengosongkannya lewat PostgREST, dan penanda yang bisa dihapus pemiliknya bukan jejak.
- Ikut daftar kolom `private.bekukan_isi_po` (kedua tuple), supaya tidak berubah pada PO yang
  sudah ditandatangani.
- Dikeluarkan dari `private.sidik_tinjauan` selama kosong, pola yang sama dengan `nama_rh`
  (`catatan/23`): sidik adalah hash seluruh baris, jadi kolom baru yang muncul kosong di setiap
  baris akan membasikan setiap draf unggahan yang sudah dinyatakan sesuai pindaian. Bila terisi,
  ia ikut disidik; ia selalu terisi sebelum Sales meninjau, jadi tidak pernah membasikan tinjauan.
- Tidak memuat apa pun dari hasil mentah. `ekstraksi_po` tetap hanya terbaca Super Admin; kolom
  ini terbaca siapa pun yang boleh membaca PO-nya, dan cuma menjawab "apakah AI mengisi awal".
- Tidak mengubah verdict IoM. `private.nilai_iom` tidak membacanya.

**Tempat tampilnya:**

1. **Lini masa PO:** peristiwa "Isian awal dibaca AI" pada waktu `dibaca_ai_pada`, dengan kunci
   `ekstraksi:<waktu>` (kunci selain komentar wajib berakhiran waktu, `catatan/20`). Bisa
   dibalas seperti peristiwa lain.
2. **Antrean Verifikasi, bagian "Terverifikasi otomatis IoM":** lencana "dibaca AI" di samping
   "lolos otomatis". Di sinilah HoO dan Tech Ops Lead menerima kabar penutupan otomatis.
3. **Halaman PO:** lencana yang sama di kepala halaman.

Uji tambahan: bukti dalam transaksi yang dibatalkan bahwa Sales tidak bisa menyetel atau
mengosongkan `dibaca_ai_pada` lewat PostgREST, dan bahwa pembacaan gagal tidak mengisinya;
penjaga lini masa untuk kunci `ekstraksi:` berakhiran waktu.

## Amandemen 25 Sep 2026 (2): cara Sales mengonfirmasi

**Masalahnya.** Aturan pengisian 2 menulis isian dari scan bertanda "sampai disentuh atau
dikonfirmasi". "Disentuh" terlalu longgar: mengeklik isian lalu keluar sudah terhitung memeriksa.
Selain itu kunci Tinjau hanya menghitung isian yang DIISI AI, jadi isian "tidak terbaca" yang tidak
wajib (alamat, telepon, email sekolah) bisa dibiarkan kosong tanpa pernah dilihat.

**Keputusan (Rizki, 25 Sep 2026): konfirmasi per langkah, ditambah centang untuk isian berisiko.**
Menggantikan kata "disentuh atau dikonfirmasi" di aturan 2, dan melengkapi aturan 4 dan 5.

1. **Tombol per langkah.** Setiap langkah wizard yang memuat isian dari scan (Sekolah, Paket &
   harga, Rombel, Termin & masa aktif, Penanda tangan & catatan) punya tombol
   "Saya sudah mencocokkan isian langkah ini dengan scan". Langkah tanpa isian dari scan tidak
   punya tombol. Hasil baca yang lengkap tetap wajib dikonfirmasi; lengkap bukan berarti benar.
2. **Centang sendiri untuk isian berisiko**, selain tombol langkahnya:
   - setiap nomor HP (kepala sekolah, bendahara), ditandai ragu atau tidak, dan tetap wajib
     dicentang sekalipun Sales mengetik ulang nomornya (aturan 4);
   - setiap isian yang ditandai ragu oleh AI; mengubah isinya juga terhitung memeriksa;
   - setiap isian "tidak terbaca": Sales mengisinya, atau mencentang "memang kosong di kertas".
3. **Tombol langkah tidak bisa ditekan** selama centang isian berisiko di langkah itu belum
   lengkap, supaya satu klik tidak melewati isian yang paling mungkin salah.
4. **Tinjau terkunci** sampai semua tombol langkah ditekan, semua centang berisiko lengkap, dan
   setiap catatan berjenis. Pernyataan "data ini sesuai dengan pindaian" tetap gerbang terakhir.
5. **Status konfirmasi ikut tersimpan bersama draf.** Membuka ulang draf hasil ekstraksi tidak
   menghapus tanda yang belum diperiksa dan tidak menuntut ulang yang sudah. Hasil mentah AI tetap
   hanya terbaca Super Admin, jadi yang disimpan untuk Sales hanyalah daftar isian yang masih
   menunggu, bukan isi hasil bacanya. Mekanismenya diputuskan di rencana.
6. **Mengubah isian sesudah langkahnya dikonfirmasi** tidak membatalkan konfirmasi langkah itu:
   mengubah adalah memeriksa. Mengubah nomor HP tetap menuntut centangnya.

Uji tambahan: status langkah (tombol terkunci selama centang berisiko belum lengkap; Tinjau terkunci
sampai semuanya lengkap; isian "tidak terbaca" yang tidak wajib ikut ditagih), dan simpan-lalu-buka
draf mempertahankan status konfirmasi.

## Amandemen 25 Sep 2026 (3): baca dulu, simpan sesudahnya

**Masalahnya.** Alur langkah 2.1 menyimpan draf kosong sebelum membaca scan. Itu mustahil:
`po.sekolah_id` NOT NULL, dan sekolah justru yang akan dibaca AI. Draf tanpa sekolah menyentuh
setiap daftar dan halaman yang menganggap PO punya sekolah.

**Keputusan (Rizki, 25 Sep 2026): scan dibaca SEBELUM draf ada.** Menggantikan alur langkah 2
dan 3, butir 4 dan 5, serta pemakaian `po_id` di bagian Data dan Perlindungan.

1. **Langkah 0.** Sales memilih PDF, mencentang pemberitahuan sekolah, menekan "Baca scan".
   Peramban merender halaman jadi JPEG (tetap di bawah 1 MB), server action mengklaim lalu
   memanggil penyedia. Belum ada draf dan belum ada scan tersimpan.
2. **Wizard terbuka dengan isian terisi.** Simpan pertama berjalan PERSIS seperti hari ini:
   draf tersimpan, scan naik ke `{id}/po.pdf`, lalu pembacaan DITAUTKAN ke PO itu dan
   `po.dibaca_ai_pada` terisi. Gagal baca: "Scan tidak terbaca, lanjutkan dengan mengetik."
3. **`ekstraksi_po.po_id` boleh kosong** sampai ditautkan, unik bila terisi: satu PO paling
   banyak satu pembacaan. Kotak "Baca scan" hanya ada saat MEMBUAT PO unggahan, jadi scan PO
   yang sudah ada tidak pernah dibaca ulang.
4. **Tiga fungsi, semuanya security definer, EXECUTE dicabut dari PUBLIC dan anon:**
   - `klaim_ekstraksi()`: gerbang menyala, pemanggil berperan pembuat PO, kurang dari 20 klaim
     hari ini (Asia/Jakarta). Mengembalikan id klaim. Sekalian mengosongkan `hasil` klaim tak
     tertaut yang lebih tua dari 24 jam.
   - `selesai_ekstraksi(id, ...)`: hanya pengklaim, sekali, dalam 5 menit sesudah klaim.
   - `tautkan_ekstraksi(id, po)`: hanya pengklaim; klaim berhasil, belum tertaut, `hasil` belum
     dikosongkan; PO milik pemanggil, `asal = 'unggahan'`, draf, belum punya pembacaan. Mengisi
     `po.dibaca_ai_pada` lewat setelan transaksi yang dikenali `po_jaga_penanda`.
5. **Percobaan yang ditinggalkan** tidak meninggalkan draf maupun scan. Yang tersisa hanya baris
   klaim (siapa, kapan, berhasil, durasi, token); `hasil` mentahnya dikosongkan sesudah 24 jam,
   jadi data pribadi dari scan tidak tinggal tanpa PO. Hasil yang tertaut mengikuti masa simpan
   scan PO (amandemen pertama).
6. **Tidak ada baca ulang oleh Super Admin.** Pembacaan yang gagal tidak menautkan apa pun; batas
   20 klaim per hari adalah pagar kerasnya. Aturan "Super Admin mengizinkan baca ulang dengan
   menghapus catatan pembacaan yang gagal" dicabut.

Batas yang diketahui (tetap dari bagian Perlindungan butir 3): semua berjalan sebagai pengguna yang
masuk, jadi Sales yang sengaja memanggil fungsi lewat API bisa mengganti catatan pembacaannya sendiri
dalam 5 menit itu. Yang terkena hanya salinan audit.

## Hasil pembangunan (25 Sep 2026) dan tinjauan independen

Dibangun lewat rencana `catatan/25` (Tugas 1-10). Tinjauan independen dijalankan sebagai langkah
terakhir (`catatan/25` Tugas 11) dan menemukan TIGA hal Important, semuanya sudah diperbaiki:

1. **`po.ekstraksi_menunggu` write-only.** Halaman PO yang sudah ada tidak pernah mengopernya ke
   formulir, jadi penanda "belum diperiksa" hilang begitu draf dibuka lagi dan Tinjau terbuka untuk
   PO yang belum dicocokkan siapa pun. Kolomnya opsional, jadi `tsc` diam saja.
2. **Kunci tak dikenal mengunci form selamanya.** `ragu`/`tidak_terbaca` dari model bisa berisi
   kunci yang tidak dimiliki langkah mana pun. Satu kunci seperti itu tidak bisa dibersihkan siapa
   pun, sehingga Tinjau terkunci permanen DAN draf tidak bisa disimpan. Sekarang kunci asing
   dibuang dari daftar tuntutan dan dipindahkan ke peringatan.
3. **Isian ragu/tidak terbaca bisa dilewati satu klik.** Rencana menutupinya dengan "mengubah isian
   juga terhitung memeriksa", tetapi sambungan `onChange` itu tidak pernah dibangun. Sekarang isian
   bertanda menuntut centang sendiri, dan penandanya ikut tersimpan sehingga bertahan saat draf
   dibuka lagi.

Dua Minor juga ditutup: nilai berkelompok seperti `"350.000"` tidak lagi dibaca 350, dan
`tautkan_ekstraksi` mengunci barisnya supaya dua permintaan berbarengan tidak sama-sama menstempel
`dibaca_ai_pada`.

**Yang belum tayang.** Migrasi `20260926{a,b,c}` BELUM diterapkan dan kode BELUM di-deploy; lihat
"Sebelum gerbang dinyalakan" di atas untuk tiga syarat yang masih tertahan, dan `HANDOFF.md` untuk
keadaan terkini.

## Di luar lingkup
- Foto JPG/PNG (tetap PDF saja, `catatan/08`).
- Baca ulang otomatis saat scan diganti.
- Pengisian harga berkelompok dan komponen untuk TKA, UTBK, ANBK, Custom.
- Ekstraksi untuk PO platform atau PKS basah.
- Penyedia kedua atau pengalih penyedia.
