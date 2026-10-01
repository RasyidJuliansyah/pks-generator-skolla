# Spesifikasi: PO unggahan (diisi manual, ditandatangani di kertas)

Status: **usulan, belum dikerjakan.** Arahnya disetujui Rizki 9 Sep 2026, dan seluruh
asumsinya divalidasi satu per satu bersama Rizki pada hari yang sama — hasil validasi
itu sudah dijalin ke dalam dokumen ini.
Ditulis lebih dulu karena fitur ini menyentuh dua hal paling sensitif sekaligus:
lantai harga dan data pribadi.

## Kebutuhan

Di awal pembuatan PO, Sales diberi dua pilihan:

1. **Buat lewat platform** — alur yang ada sekarang.
2. **Unggah PO** yang sudah diisi manual beserta tanda tangannya.

Data pada PO yang diunggah ditangkap sistem, lalu **ditinjau Sales** sebelum PO
boleh masuk tahap verifikasi.

## Jebakan yang menentukan seluruh rancangan

Seluruh aturan bisnis hidup di `periksa()` (`lib/po-aksi.ts`): lantai bottom price,
batas minimal peserta, kapasitas sesi, dan total termin harus sama dengan grand total.

**PO yang diisi tangan di kertas tidak melewati satu pun dari itu.**

Kalau data hasil tangkap langsung maju ke verifikasi, jalur unggah menjadi cara SAH
untuk menembus lantai harga — dan karena ia jalur yang lebih gampang, ia yang akan
dipakai. Ini lubang yang sama seperti RLS `po_buat` yang bisa ditembus lewat PostgREST
(lihat `catatan/02-jebakan-dan-bug.md`), hanya saja versi ini terlihat resmi.

Maka: **data hasil tangkap wajib melewati `periksa()` yang sama persis.**

### Kalau kertasnya sudah telanjur melanggar

Kertas sudah ditandatangani; tidak bisa dibatalkan. Jadi hasil `periksa()` yang gagal
tidak boleh sekadar menolak dan buntu.

Aturannya: PO unggahan yang melanggar **boleh disimpan dan ditinjau, tetapi tidak bisa
maju ke verifikasi tanpa persetujuan eksplisit Head of Operations**, dan persetujuan itu
tercatat berikut daftar pelanggaran yang disetujui. Dengan begitu jalur unggah berubah
dari lubang menjadi gerbang pengecualian yang ketahuan dan bisa dihitung.

## Prinsip: hasil tangkap adalah alat bantu ketik

Yang tersimpan di basis data adalah **yang dikonfirmasi Sales**, bukan keluaran mesin.
Pindaian adalah buktinya, bukan datanya. Momen peninjauan itulah pernyataan Sales
bahwa angka di sistem sama dengan angka di kertas.

Konsekuensi yang disengaja: salah baca OCR pada tulisan tangan tidak berbahaya, karena
ia akan dikoreksi — bukan diam-diam masuk. Rancangan ini tidak pernah bergantung pada
akurasi ekstraksi.

## Alur status

PO unggahan sudah melewati penandatanganan di dunia nyata, jadi ia **tidak melewati
`menunggu_ttd`**:

1. Sales pilih "Unggah PO" → pindaian diunggah → PO berstatus `draf`, `asal = 'unggahan'`
2. Form terisi dari hasil tangkap; Sales **meninjau dan mengoreksi**
3. Saat diajukan:
   - `periksa()` dijalankan
   - tiga baris `tanda_tangan` dibuat dengan `asal = 'pindaian'`
   - status lompat ke `ditandatangani`
4. Selanjutnya `verifikasi` seperti biasa; verifikator bisa membuka pindaiannya

Langkah 3 mempertahankan invarian yang sudah ada: `ajukanVerifikasi()` menuntut tiga
tanda tangan lengkap sebelum PO boleh maju. Invarian itu **dipertahankan, bukan
dilonggarkan** — yang berubah hanya asal tanda tangannya.

Divalidasi 9 Sep 2026: kertas yang diunggah **selalu sudah lengkap bertiga**
(kepala sekolah, Partnership Manager, Sales Manager), jadi melompati `menunggu_ttd`
memang benar. Tapi perlu ditulis terang: **sistem tidak bisa memastikan sendiri bahwa
ketiga tanda tangan benar-benar ada di gambar itu.** Yang menahannya adalah pernyataan
Sales saat meninjau, ditambah verifikator yang membuka pindaiannya. Jangan sampai
dikira ini dijaga mesin.

## Skema

```sql
alter table po add column asal text not null default 'platform'
  check (asal in ('platform', 'unggahan'));
alter table po add column berkas_unggahan text;      -- jalur di bucket po-unggahan
alter table po add column ditinjau_pada timestamptz;  -- saat Sales menyatakan cocok
alter table po add column ditinjau_oleh text;

alter table tanda_tangan add column asal text not null default 'aplikasi'
  check (asal in ('aplikasi', 'pindaian'));

create table po_pengecualian (
  po_id          uuid primary key references po(id) on delete cascade,
  pelanggaran    text[] not null,   -- salinan pesan periksa() SAAT disetujui
  alasan         text not null,
  disetujui_oleh text not null,
  disetujui_pada timestamptz not null default now()
);
```

Bucket baru **`po-unggahan`**: privat, batas 15 MB — mengikuti `pks-basah` yang sudah
ada, bukan angka baru yang dikarang.

Untuk PO unggahan, ketiga baris `tanda_tangan` menunjuk berkas pindaian yang sama;
tanda tangannya memang ada di dalam lembar itu, bukan sebagai gambar terpisah.

`default 'platform'` membuat seluruh PO lama tidak tersentuh dan tetap berperilaku
persis seperti sekarang.

## Penjagaan

**`periksa()` dijalankan sama persis** untuk kedua jalur. Tidak ada cabang khusus yang
melonggarkan aturan untuk PO unggahan.

**Gerbang pengecualian.** `ajukanVerifikasi()` untuk `asal = 'unggahan'` hanya lolos bila:

- `periksa()` bersih, **atau**
- ada baris `po_pengecualian` yang `pelanggaran`-nya **sama persis** dengan pelanggaran
  saat itu

Syarat kedua penting: kalau PO disunting setelah disetujui dan kini melanggar hal lain,
persetujuan lama **tidak** ikut menutupinya. Persetujuan berlaku untuk pelanggaran yang
memang dilihat penyetujunya, bukan untuk PO itu selamanya.

**Penyetujunya Head of Operations, bukan Head of Sales.** Alasannya struktural: RLS
`po_buat` hanya mengizinkan peran `sales`, `head_of_sales`, dan `admin_sales` membuat PO,
sehingga Head of Operations **tidak bisa membuat PO sama sekali**. Penyetujunya karena itu
berdiri di luar lini yang menutup kesepakatan — pemisahan yang melekat pada perannya,
bukan yang harus dipaksakan.

**Penyetuju tetap tidak boleh sama dengan pengunggah**, dan pemeriksaan itu tetap perlu
meski di atas terdengar sudah aman: kolom `pengguna.peran` bertipe ARRAY, dan per 9 Sep
2026 ada **3 pengguna yang memegang lebih dari satu peran**. Hari ini belum ada yang
memegang Head of Operations sekaligus peran sales, jadi pemisahannya aman **karena
kebetulan, bukan karena struktur**. Ditegakkan di basis data, bukan di layar.

**Trigger lantai di basis data** (lihat `catatan/07-spesifikasi-kelompok-po.md`) menjadi
lebih penting di sini, karena jalur unggah menambah satu pintu lagi ke `po`.

## Layar

- Di `/po/baru`, pilihan pertama: **"Buat di platform"** atau **"Unggah PO"**.
- Jalur unggah: unggah berkas → tampilkan pindaian **berdampingan** dengan form isian.
  Berdampingan, bukan bergantian, supaya Sales membandingkan sambil meninjau, bukan
  mengingat.
- Bidang yang berasal dari tangkapan mesin diberi tanda sampai disentuh Sales, sehingga
  jelas mana yang sudah benar-benar dilihat orang.
- Tombol ajukan mati sampai Sales menekan konfirmasi "data ini sesuai dengan pindaian".
- Kalau `periksa()` gagal: pelanggarannya ditampilkan apa adanya, plus tombol minta
  persetujuan Head of Operations — bukan pesan buntu.

## Dokumen

- Pindaian itulah dokumen PO-nya. Tombol Cetak/Simpan PDF diganti tautan ke pindaian.
- Platform **tidak menerbitkan PDF Form PO secara otomatis**, tetapi menyediakannya
  **bila diminta** — dan tombolnya baru hidup **setelah Sales mengonfirmasi kesesuaian
  data** (`ditinjau_pada` terisi). Salinan itu diberi label **"salinan sistem, bukan
  dokumen yang ditandatangani"**; tanpa label, dua berkas sama-sama terlihat seperti PO
  yang sah padahal hanya satu yang ditandatangani.
- **PKS tetap selalu diterbitkan platform dari data PO** (divalidasi 9 Sep 2026). PKS
  menuntut praktis seluruh isi form — sekolah lengkap, komponen, masa aktif, jumlah siswa
  dan guru, grand total, termin, dan kelas dari rombel. Maka **tangkapan wajib lengkap
  sejak awal**, bukan dilengkapi belakangan.
- Konsekuensi jujur yang perlu disadari: **sebelum ekstraksi ada di fase dua, jalur
  unggah tidak menghemat pengetikan sama sekali.** Sales tetap mengisi form yang sama,
  ditambah mengunggah pindaian. Nilainya bukan kecepatan, melainkan sistem jadi bisa
  menerima kesepakatan yang telanjur ditutup di kertas.
- Surat Verifikasi tidak berubah.

## Ekstraksi — dan kenapa ia ditunda ke fase dua

Ekstraksi butuh model vision, artinya pindaian dikirim ke layanan pihak ketiga.
Pindaian itu memuat nama kepala sekolah, nomor HP, tanda tangan basah — data pribadi —
sekaligus harga kesepakatan.

`catatan/05-penahan-peluncuran.md` mencatat retensi berkas tanda tangan dan pindaian PKS
sebagai penahan peluncuran yang **belum selesai** (UU PDP 27/2022). Menambah pengiriman
ke pihak ketiga sebelum itu beres berarti menumpuk kewajiban di atas kewajiban yang
belum dijawab.

**Karena itu fase satu tidak memakai ekstraksi sama sekali.** Sales mengunggah pindaian
lalu mengisi form sambil melihatnya berdampingan. Nilai utamanya — sistem menerima PO
yang ditandatangani manual — sudah didapat penuh tanpa mengirim apa pun ke luar.

Diputuskan 9 Sep 2026: **pemrosesan di luar negeri diizinkan, DENGAN perjanjian
pemrosesan data.** Syarat itu adalah **gerbang, bukan catatan kaki** — fase dua tidak
dimulai sebelum perjanjiannya benar-benar ada. Kalau ditulis sebagai syarat lunak, ia
akan menguap begitu fase satu selesai dan ekstraksi terasa mendesak.

Ini juga menyentuh pertanyaan yang sudah lama menggantung di
`catatan/retensi-data-pribadi.md`: apakah sekolah diberi tahu tujuan dan masa simpan
datanya. Kalau pindaiannya dikirim ke luar negeri, jawabannya kemungkinan besar iya, dan
kalimatnya paling wajar ikut di Form Pre Order.

## Ekstraksi: keputusan 14 Sep 2026

> **Digantikan sebagian 17 Sep 2026: spesifikasinya kini `catatan/17-spesifikasi-ekstraksi-scan-po.md`.**
> Rizki memilih **DeepSeek V4 Flash Vision lewat OpenCode Go**, bukan Mistral OCR, sesudah uji
> pada dua PO asli bertulisan tangan (66/71 isian benar). Penyedia itu **tanpa DPA**, jadi
> keputusan 9 Sep (pemrosesan luar negeri hanya dengan perjanjian pemrosesan data, sebagai
> gerbang) **dibatalkan untuk ekstraksi**: gerbang organisasi kini mencatat siapa yang menerima
> risikonya dan alasannya, bukan rujukan DPA. Lapis per unggahan (centang Sales) tetap, dan
> berjalan tanpa menunggu kalimat pemberitahuan disetujui legal. Fakta Mistral di bawah
> dibiarkan sebagai catatan sejarah.

Dirancang bersama Rizki 14 Sep 2026 sebagai **sub-proyek 2**, sesudah wizard
(`catatan/11-spesifikasi-wizard-po.md`). Punya spesifikasinya sendiri sebelum dibangun.

**Tujuan:** isian wizard PO unggahan terisi dari hasil baca scan; Sales tinggal memeriksa
dan melengkapi. Prinsip di atas tetap: yang tersimpan hanya yang dikonfirmasi Sales.

**Gerbang dua lapis**, keduanya ditegakkan sistem, bukan hanya tampilan:

1. **Organisasi.** Ekstraksi mati sampai Super Admin menyalakannya, dan tombolnya hanya bisa
   dinyalakan dengan catatan: penyedia, paket akun, **pelatihan pada data sudah dimatikan dan
   diperiksa di konsol penyedia**, rujukan DPA, tanggal, dan siapa yang memeriksa. Server
   menolak mengirim scan ke penyedia selama tombol mati. Jadi ekstraksi boleh dibangun dan
   diuji dengan data rekaan sebelum gerbang terbuka; scan asli baru terkirim sesudahnya.
2. **Per unggahan.** Sebelum scan diproses, Sales menyatakan sekolah sudah diberi tahu
   bahwa PO-nya dibaca layanan AI. Terkait kalimat pemberitahuan di `catatan/10` yang masih
   menunggu tinjauan legal.

Catatan: "perjanjian pemrosesan data" adalah kontrak Skolla dengan penyedia, bukan
persetujuan yang diklik Sales. Lapis 2 tidak menggantikan lapis 1.

**Penyedia: Mistral OCR** (`mistral-ocr-latest`), sudah dipakai Skolla di Product
Knowledge Builder. Menerima PDF langsung; berbasis Uni Eropa.

**Pendekatan A:** satu panggilan OCR dengan anotasi dokumen berskema JSON sesuai isian PO.
Scan dibaca penyedia lewat tautan bertanda tangan berumur pendek, tidak dikirim lewat
server aplikasi. Hasilnya jadi isian awal wizard, tiap isian bertanda "dari scan, periksa".
**Pendekatan C** (OCR ke teks, lalu model chat Mistral memetakan) hanya bila uji menunjukkan
A kurang akurat. B (aturan tetap berbasis label) ditolak: rapuh terhadap tulisan tangan.

**Fakta penyedia, dengan sumbernya:**

- DPA berlaku otomatis lewat syarat Mistral, tanpa tanda tangan terpisah (DPA pasal 11.2,
  legal.mistral.ai/terms/data-processing-addendum). **Terverifikasi.**
- DPA pasal 2.3: Mistral boleh memakai data untuk melatih modelnya **kecuali pelanggan
  memilih keluar**, dan untuk pemantauan penyalahgunaan kecuali retensi nol diaktifkan.
  **Terverifikasi.**
- Artikel bantuan resmi: mode gratis boleh dipakai melatih; bayar sesuai pakai "berhak
  memilih keluar kapan saja". Artikel itu **tidak** menyebut pelanggan berbayar otomatis
  dikeluarkan. **Terverifikasi.** Klaim sumber sekunder "API berbayar otomatis dikecualikan"
  karena itu tidak dipakai; opsi pelatihan harus diperiksa langsung di konsol.
- Retensi 30 hari untuk pemantauan penyalahgunaan dan retensi nol hanya di paket tertentu:
  **belum terverifikasi**, hanya dari sumber sekunder. Dicek sebelum spesifikasi sub-proyek 2.

**Kemampuan yang belum terbukti:** akurasi pada tulisan tangan di Form PO. Dokumentasi
Mistral mengakui tulisan yang sangat berantakan masih bisa gagal.

**Prasyarat uji (spike) sebelum membangun:**

- Tim mengisi Form PO dengan tulisan tangan memakai **data rekaan** (sekolah fiktif, nomor
  palsu), lalu memindainya jadi PDF.
- Kunci API Mistral dipasang ke variabel lingkungan oleh orang yang berwenang, tidak
  pernah ditempel di percakapan. Agen tidak membaca isi `.env*`.

**Pertanyaan terbuka untuk spesifikasi sub-proyek 2:**

- Urutan unggah: hari ini scan baru naik SESUDAH PO tersimpan (kebijakan penyimpanan
  menuntut PO sudah ada dan masih draf), sedangkan ekstraksi butuh scan SEBELUM isian ada.
  Perlu jalur unggah sementara, atau PO draf dibuat lebih dulu.
- Lama proses OCR tiga halaman terhadap batas waktu fungsi Vercel.

## Urutan pengerjaan

1. Skema + bucket + backfill `asal = 'platform'`. Tanpa perubahan perilaku; diuji bahwa
   seluruh PO lama identik.
2. Gerbang pengecualian: `po_pengecualian`, aturan `ajukanVerifikasi()`, penyetuju ≠ pengunggah.
3. Unggah + form berdampingan + konfirmasi kesesuaian (**tanpa ekstraksi**).
4. Verifikator bisa membuka pindaian; dokumen menyesuaikan.
5. Ekstraksi, setelah kebijakan retensi dan layanan diputuskan. Keputusan 14 Sep 2026: sub-proyek 2
   sesudah wizard, lihat "Ekstraksi: keputusan 14 Sep 2026" di atas.

Langkah 1 dan 2 tidak mengubah apa pun yang dilihat Sales, jadi bisa naik lebih dulu.

## Sudah diputuskan (validasi 9 Sep 2026)

| Hal | Keputusan |
|---|---|
| Tanda tangan di kertas | Selalu lengkap bertiga; PO unggahan melompati `menunggu_ttd` |
| PKS | Selalu diterbitkan platform → tangkapan wajib lengkap sejak awal |
| Penyetuju pengecualian | **Head of Operations**, bukan Head of Sales |
| Penyetuju ≠ pengunggah | Tetap ditegakkan di basis data (peran bertipe ARRAY) |
| PDF Form PO | Hanya bila diminta, setelah konfirmasi, berlabel salinan sistem |
| Retensi pindaian PO | Seperti pindaian PKS — **tidak dihapus** |
| Ekstraksi lintas negara | Diizinkan **dengan** perjanjian pemrosesan data, sebagai gerbang |
| Format berkas | **PDF saja** di fase satu; foto menyusul bila terbukti dibutuhkan |

## Yang masih terbuka

- **Foto JPG/PNG di fase berikutnya.** Form PO tiga halaman: PDF menampungnya sebagai
  satu berkas, foto berarti beberapa berkas yang harus diurutkan, dan foto ponsel lebih
  mungkin miring serta buram — menyulitkan verifikator sekaligus menurunkan akurasi
  ekstraksi. Ditunda sampai Sales terbukti kesulitan dengan PDF.
- **Empat pertanyaan lama di `catatan/retensi-data-pribadi.md`** masih menunggu, dan
  sekarang bertambah relevan karena pindaian PO ikut masuk register.

## Pemeriksaan sebelum PKS

Pertanyaan "apakah PO unggahan perlu pemeriksaan tambahan sebelum PKS" tidak dijawab
dengan gerbang baru. Rizki menunjukkan akar masalah yang lebih luas: hasil verifikasi
bisa berbeda karena percakapan antar peran, dan percakapan itu hari ini terjadi di luar
sistem sehingga alasan sebuah keputusan tidak pernah tercatat di PO-nya.

Jawabannya karena itu ada di `catatan/09-spesifikasi-komentar-po.md` — utas komentar
pada setiap PO, berlaku untuk semua PO, bukan khusus jalur unggah.

## Uji yang wajib ada

- PO unggahan yang harganya di bawah lantai **ditolak** maju ke verifikasi, dan
  ditolak juga bila ditembus lewat PostgREST langsung.
- Persetujuan pengecualian yang dibuat untuk pelanggaran A **tidak** meloloskan PO yang
  kemudian melanggar B.
- Penyetuju yang sama dengan pengunggah ditolak.
- PO unggahan tanpa tiga baris `tanda_tangan` tidak bisa maju.
- PO `asal = 'platform'` berperilaku identik dengan sebelum perubahan — penjaga utama
  seluruh pekerjaan ini.
- PO unggahan tidak menerbitkan PDF Form PO, tetapi PKS-nya tetap terbit lengkap.
