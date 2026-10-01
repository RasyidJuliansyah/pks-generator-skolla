# Riwayat Keputusan (pesan commit)

Diekspor dari git. Tiap entri menjelaskan apa yang berubah dan kenapa.

## 2026-08-29 — Kerangka sistem kerjasama sekolah — Tahap A langkah 1

Next.js + Supabase, login Google Workspace, dan peran.

- Tabel pengguna berfungsi sekaligus sebagai daftar izin
- Fungsi pembantu di skema private, tidak terekspos PostgREST
- Beranda menampilkan bagian sesuai peran; isinya menyusul
- Pricelist sengaja tidak masuk basis data

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Pengalih tema terang/gelap

Dua posisi. Sebelum ada pilihan tegas, tema ikut setelan sistem dan tidak
disimpan. Skrip kecil di <head> memasangnya sebelum cat pertama supaya
tidak berkedip saat memuat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Duplikasi pricelist + uji kesetiaan salinan

Harga disalin dari kalkulator, bukan dipindahkan — kalkulator lama tetap
berdiri sendiri sebagai cadangan. Uji membandingkan jumlah komponen dengan
angka paket; kalau salinan menyimpang, angka itu yang meleset.

Aturan batas minimal peserta dan kapasitas per sesi ikut disalin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Kalkulator PO di sistem baru

Inti perhitungan dibuat murni tanpa DOM (lib/hitung.ts) supaya bisa diuji
langsung; antarmukanya React. Acquisition Price dipotong di server sebelum
data sampai ke peramban.

Delapan pemeriksaan menguji hasilnya terhadap angka yang sudah diverifikasi
di kalkulator lama, termasuk pemisahan guru dan aturan kapasitas per sesi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Dashboard sebagai halaman awal + menu di panel samping

Halaman beranda jadi dashboard dengan KPI; navigasi pindah ke sidebar yang
menyaring menu sesuai peran. Halaman dipindah ke route group (sistem) supaya
berbagi satu kerangka; alamatnya tidak berubah.

Grafik SENGAJA belum dibuat: belum ada satu pun PO tersimpan, dan grafik
kosong terlihat seperti data yang gagal dimuat. Keadaan kosongnya dibuat
menjelaskan apa yang akan muncul.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Pisahkan Dashboard dan Analytics

Dashboard jadi ringkasan dua hal yang berjalan: Overview PO dan Overview PKS.
Penggalian data pindah ke menu Analytics tersendiri.

Grafik masih sengaja belum digambar sampai ada data.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Skema PO + RLS, dan buang pengalih tema ganda dari kalkulator

Tabel sekolah, po, po_komponen, po_rombel, po_termin, po_catatan. Hanya harga
kesepakatan yang tersimpan; Price List, Bottom Price, dan Acquisition Price
tetap di kode.

RLS: Sales hanya melihat PO buatannya, enam peran lain seluruhnya. Penyuntingan
dibatasi ke pembuat/Head of Sales/Admin Sales dan hanya saat status draf atau
ditolak.

Pengalih tema di kalkulator dibuang — sidebar sudah menyediakannya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Simpan dan muat PO

Form lengkap: komponen, data sekolah, grid rombel, termin, harga kesepakatan,
masa aktif, dan catatan. Draf tersimpan lalu bisa dibuka kembali.

Aturan bisnis diperiksa ULANG di server — batas minimal peserta, kapasitas
per sesi, lantai Bottom Price, dan kesamaan total termin. Penjagaan di
peramban hanya membantu pengguna; permintaan bisa dikirim tanpa melewatinya.

Daftar PO disaring RLS: Sales hanya melihat buatannya sendiri.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Pratinjau dokumen PO + perbaikan input tanggal

Dokumen tiga halaman A4 dipindahkan: markup, kelas, dan aturan cetaknya sama
dengan kalkulator lama yang tata letaknya sudah teruji. Paginasi ditentukan
sendiri — satu kotak = satu halaman — bukan diserahkan ke browser.

Ikon kalender bawaan tidak terlihat di mode gelap karena glif gelap di atas
bidang gelap; sekarang dibalik warnanya. Klik di mana pun pada bidang tanggal
membuka pemilih, bukan hanya di ikonnya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Perbaiki bidang angka, tata letak pratinjau, dan label DP

Bidang angka tidak bisa dikosongkan: string kosong dipaksa kembali jadi 0,
sehingga nolnya tak bisa dihapus dan angka baru menempel di belakangnya —
"12" jadi "012". Teks bidang kini disimpan terpisah sehingga boleh kosong
sementara diketik; nol di depan dibuang.

Pratinjau dokumen dipindah ke luar kisi form — kotak A4 lebih lebar dari
kolomnya dan panel harga lengket, jadi keduanya saling tindih.

"Down Payment" jadi "DP".

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Daftar PO berdiri sendiri: ringkasan status + tombol Buat PO

Menu jadi "Daftar PO (Pre-Order)". Halamannya kini memuat ringkasan jumlah PO
per status yang bisa diklik untuk menyaring, lalu daftarnya, dengan tombol
Buat PO yang membuka kalkulator.

Urutan status mengikuti perjalanan PO, bukan abjad, supaya terbaca sebagai
alur. Hitungannya ikut cakupan peran karena RLS yang menyaring barisnya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Tanda tangan digital pada PO

Kanvas tanda tangan untuk tiga pihak, disimpan di bucket privat dan dibaca
lewat URL bertanda tangan berumur pendek — berkasnya tidak pernah publik.

Alur status: draf -> menunggu TTD (PO terkunci) -> ditandatangani otomatis
setelah ketiganya lengkap. Bisa dikembalikan ke draf, dan tanda tangan yang
sudah ada ikut dihapus supaya tidak menempel pada isi yang berubah.

Tanda tangan ini tidak tersertifikasi; PKS tetap basah di atas meterai.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Perbaiki RLS transisi status, batasi termin, dropdown penanda tangan

BUG: kebijakan po_ubah memakai boleh_ubah_po di WITH CHECK, yang mensyaratkan
status draf/ditolak. Pada UPDATE, USING menilai baris lama sedangkan WITH CHECK
menilai baris baru — sehingga draf -> menunggu_ttd selalu ditolak dan tombol
"Kirim untuk ditandatangani" gagal. USING kini menentukan PO mana yang boleh
disentuh, WITH CHECK memastikan hasilnya masih di fase sales.

Termin dibatasi sisa yang belum teralokasi, jadi totalnya tidak bisa melebihi
grand total sejak saat diketik.

Partnership Manager dan Sales Manager kini dipilih dari daftar akun, tersimpan
di PO, dan tercetak di halaman tanda tangan. Kebijakan tabel pengguna diperluas
supaya sesama akun terdaftar bisa saling melihat — dropdown-nya kosong tanpa itu.

Catatan di dokumen: isinya turun ke bawah judul, tidak lagi menyamping.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Nama penanda tangan tidak lagi diketik ulang

Ketiga nama sudah ada: kepala sekolah dari data sekolah, PM dan SM dari
dropdown di form. Meminta mengetik ulang saat membubuhkan tanda tangan
menciptakan dua sumber yang bisa berbeda isinya.

Kanvas kini hanya menangkap goresan dan menampilkan atas nama siapa. Kartu
yang namanya belum diisi menonaktifkan tombol Bubuhkan dan menunjuk ke tempat
mengisinya.

Nama tetap disimpan pada catatan tanda tangan sebagai rekaman siapa yang
menandatangani saat itu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Tanda tangan tampil di dokumen, lalu diajukan untuk verifikasi

Gambar tanda tangan tertanam di kolom masing-masing pihak pada halaman 2,
di atas garis nama. PO yang terkunci kini juga menampilkan pratinjau dokumen,
bukan hanya keterangan bahwa ia terkunci.

Setelah ketiganya lengkap, muncul tombol Ajukan untuk verifikasi. Kelengkapan
tanda tangan diperiksa di server, bukan hanya di antarmuka. Sesudah diajukan,
PO keluar dari fase sales dan kewenangan berpindah ke empat verifikator.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Verifikasi empat fungsi

Education, Tech Ops, Finance, dan Service Account memutuskan paralel, masing-
masing dengan daftar periksanya sendiri dari dokumen checklist tim Operasional.
Bagian Finance dan Service Account ditambahkan karena dokumen aslinya tidak
punya satu pun item keuangan maupun kesiapan layanan.

Penolakan wajib disertai catatan. Tech Ops Lead menutup tahap: keempat lampu
hijau jadi terverifikasi, satu penolakan jadi ditolak. Sales bisa menarik PO
yang ditolak kembali ke draf.

Reset selektif: hanya persetujuan yang wilayahnya tersentuh yang dibatalkan
saat PO direvisi. Harga berubah membatalkan Finance saja; komponen berubah
membatalkan tiga fungsi lain. Diuji terpisah di uji/reset-selektif.test.mjs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Simpan riwayat verifikasi dan tambah hasil setuju dengan catatan

Keputusan verifikasi yang basi karena PO direvisi semula DIHAPUS, sehingga
catatan penolakan lenyap begitu diperbaiki. Sekarang ditandai tidak berlaku
dan tampil sebagai riwayat di halaman PO: siapa menolak, alasannya, versi
berapa, dan apa yang berubah.

Dokumen checklist aslinya punya tiga kesimpulan; sistem hanya membangun dua.
Hasil ketiga 'setuju dengan catatan' ditambahkan untuk hal yang tidak
menghambat tapi punya syarat yang harus dibawa ke pelaksanaan. Catatan itulah
yang nanti tercetak di Surat Verifikasi Kesiapan — masalah yang sudah selesai
tinggal di riwayat, tidak ikut ke surat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Terbitkan Surat Verifikasi Kesiapan dari PO terverifikasi

Susunan surat mengikuti sembilan surat asli yang sudah diterbitkan Tech Ops
Lead: kalimat pembuka, baris identitas, kalimat penutup, dan blok tanda tangan
disalin apa adanya. Suratnya berdiri di halamannya sendiri (/po/[id]/surat)
supaya mencetak menghasilkan surat saja, bukan ikut membawa dokumen PO.

Dua penyimpangan yang disengaja dari surat asli:
- Surat asli menyebut verifikasi 'dari sisi Education dan Tech Ops'; sekarang
  Finance dan Service Account juga memberi lampu hijau, jadi yang disebut
  adalah fungsi yang benar-benar memutuskan.
- Catatan tidak diketik ulang, diambil dari keputusan 'setuju dengan catatan'
  yang masih berlaku. Penolakan yang sudah diperbaiki tidak ikut tercetak.

Penutup verifikasi dan waktunya kini dicatat di PO; namanya yang menandatangani
surat dan tanggalnya yang tercetak.

Penulisan tajuk disesuaikan kaidah PUEBI (huruf kapital tiap kata kecuali
partikel), dan butir 'Tutor dan materi tersedia' dihapus dari daftar periksa
Service Account karena bukan tanggung jawabnya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Penerbitan Surat: tanda tangan Tech Ops Lead, finalisasi, dan gerbang PKS

Menu Penerbitan Surat dan Kelola Pengguna ada di sidebar tanpa halaman —
keduanya tautan mati. Halaman /surat kini dibangun; menu Kelola Pengguna
disembunyikan sampai halamannya ada.

Surat punya tabel sendiri, bukan menumpang tanda_tangan: aturan tabel itu
terikat status menunggu_ttd dan peran sales, dan memakainya ulang berarti
melonggarkan penjagaan tanda tangan PO. Berkasnya dibatasi ke awalan surat/
supaya tidak bisa menimpa tanda tangan PO.

Tombol Cetak diganti Finalisasi Surat. Selama draf, surat bisa ditandatangani
ulang; setelah final ia terkunci di tingkat kebijakan basis data (USING menilai
baris lama) dan barulah tombol cetak muncul. PKS bergantung pada surat yang
final, bukan sekadar PO terverifikasi.

Perbaikan lain: tajuk menu mengikuti kaidah PUEBI, dan titik status di antrean
tidak lagi menandai 'setuju dengan catatan' sebagai penolakan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Generator PKS: penomoran berurutan, 14 pasal, dan gerbang surat final

Isi keempat belas pasal disalin dari PKS asli yang sudah ditandatangani
(rujukan PKS SMKS PGRI 1 Surabaya, 175/EXTSKOLLA/PKS/VIII/2026). Satu ketentuan
sengaja diperbaiki: Pasal 6 ayat 5 semula menyatakan nilai 'belum termasuk
pajak' dan membebankannya ke sekolah, bertentangan dengan pricelist yang
harganya sudah termasuk pajak.

Terbilang dipisah ke berkas sendiri berikut ujinya: nilainya tercetak
berdampingan dengan angkanya di dokumen yang mengikat secara hukum, jadi
selisih satu kata berarti dua nilai berbeda dalam satu perjanjian.

Penomoran memakai fungsi basis data yang mengunci baris penomoran lebih dulu,
supaya dua sales yang menekan tombol bersamaan tidak mendapat nomor yang sama.
Penghitungnya disemai di 175 agar tidak bentrok dengan PKS yang sudah terbit di
luar sistem.

Paginasi diserahkan ke CSS, bukan kotak A4 tetap seperti Form Pre Order:
panjang PKS berubah menurut jumlah komponen dan termin.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Kop dan kaki halaman PKS, dengan paginasi yang diukur sendiri

PKS asli memakai kop satu halaman penuh (210x297mm) yang berulang di tiap
halaman, kotak paraf PIHAK I/PIHAK II di kiri bawah, dan 'Halaman x dari y' di
kanan bawah. Ketiganya tidak bisa didapat dari pemenggalan halaman CSS: latar
berulang tidak seragam antar peramban, dan CSS tidak bisa menyebut jumlah
halaman total. Karena itu isinya diukur di peramban lalu dibagi sendiri ke
dalam kotak A4.

Pemecahan menelusuri daftar bersarang, bukan hanya butir tingkat atas. Daftar
termin hidup sebagai satu butir di dalam ayat Pasal 6; tanpa penelusuran itu,
PKS dengan 12 termin menghasilkan satu butir setinggi 984px yang tidak pernah
muat, lalu terpotong tak terlihat.

Tiga cacat yang tertangkap saat pengujian dan ikut diperbaiki: node asli
sempat dipindahkan sehingga pengukuran kedua kehilangan satu pasal; teks
pembuka butir hilang karena hanya elemen yang disalin, padahal teks itu simpul
teks; dan marjin milik blok sendiri tidak dihitung sehingga halaman meluber
beberapa milimeter. Isi yang tidak muat kini dibiarkan terlihat meluber, bukan
disembunyikan.

Surat Verifikasi Kesiapan sengaja tidak berkop: dokumen aslinya memang polos.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Turunkan kotak paraf dan nomor halaman sesuai ukuran PKS asli

Letaknya sebelumnya ditaksir. Diukur dari render PKS asli: kotak paraf 8mm
dari tepi kiri dan 7,6mm dari tepi bawah (bukan 14mm, jadi 6,4mm terlalu
tinggi), lebar 31,5mm, tinggi 13mm; nomor halaman 26,5mm dari tepi kanan
dengan dasar teks 18,6mm dari tepi bawah.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Perbaiki relasi unik yang dibaca sebagai larik

PostgREST menyematkan relasi sebagai larik bila kunci asingnya boleh berulang,
tetapi sebagai OBJEK tunggal bila kolom itu unik. surat_verifikasi dan pks
memakai unique (po_id) — satu PO satu dokumen — sehingga keduanya datang
sebagai objek, sementara kode membacanya dengan [0] dan selalu mendapat
undefined.

Akibatnya tanda tangan Tech Ops Lead tersimpan tapi tidak pernah tampil,
halaman Penerbitan Surat selalu menyatakan 'Belum dibuat', gerbang PKS tidak
pernah terbuka, dan tombol Buat draf PKS akan ditawarkan ulang untuk PO yang
sudah punya PKS.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Riwayat keputusan verifikasi tetap tampil setelah tahapnya ditutup

Halaman antrean hanya menarik PO berstatus verifikasi, sehingga bagian 'Sudah
kamu putuskan' ikut kosong begitu Tech Ops Lead menutup tahapnya — seolah
keputusan yang sudah diberikan hilang, padahal tersimpan utuh.

Antrean tetap hanya memuat yang tahapnya masih terbuka; bagian riwayat kini
memuat apa pun yang sudah diputuskan pengguna ini, lengkap dengan status akhir
POnya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — PKS jadi menu tersendiri, lepas dari PO

PKS adalah dokumen tersendiri, bukan lampiran PO. Rutenya ikut dipindahkan
dari /po/[id]/pks ke /pks/[id] supaya pemisahannya nyata, bukan hanya menu.

Daftar PKS terbagi tiga: siap disusun (surat sudah final), sudah dibuat
(dengan nomor perjanjian dan status draf/final), dan menunggu surat
difinalisasi — bagian terakhir menjelaskan kenapa sebuah PO belum bisa
dilanjutkan, alih-alih menyembunyikannya.

Halaman PO kini hanya menyebut keadaan PKSnya dan menunjuk ke menu, tidak lagi
jadi pintu masuk. revalidatePath ikut disesuaikan; yang lama menunjuk rute yang
sudah tidak ada dan diam-diam tidak menyegarkan apa pun.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Mode terang jadi bawaan, dan teks tombol di dalam tabel terbaca lagi

Aturan .tabel-daftar a menimpa warna teks tombol, sehingga 'Susun PKS' tampil
biru tua di atas latar biru tua alias tidak terbaca di mode terang. Tautan
biasa saja yang diwarnai; tombol membawa warnanya sendiri.

Tema tidak lagi mengikuti setelan sistem. Bawaannya terang; gelap hanya
berlaku bila pengguna memilihnya sendiri, dan pilihan itu diingat. Kelima blok
prefers-color-scheme dibuang — keempat aturan gelap di dalamnya sudah punya
padanan [data-theme=dark], termasuk pembalik ikon kalender, jadi tidak ada
perbaikan mode gelap yang hilang.

Kontras kedua mode diperiksa dengan hitungan WCAG, bukan dilihat sekilas:
semuanya lulus AA.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Rapikan tata paragraf PKS mengikuti ukuran dokumen asli

Empat hal yang membuatnya berantakan, ketiganya diukur dari render PKS asli:

- Nama pihak ikut dirata kanan-kiri sehingga diregangkan dan patah di tengah
  nama ('KUSTIONO,   S.T.,' lalu 'M.M.'). Kini hanya kolom uraian yang dirata
  kanan-kiri.
- Lebar kolom tabel pihak asal tebak. Aslinya nomor mulai 3,2mm, nama 10,4mm,
  dan uraian 79,4mm dari tepi kiri kertas; kolom uraian dibuat ~88mm mendekati
  89mm pada aslinya supaya spasinya tidak melebar jadi sungai.
- Dua baris 'Nomor Perjanjian' dipusatkan sendiri-sendiri sehingga tidak
  segaris. Aslinya keduanya rata kiri pada satu takuk di 55,1mm.
- Butir pembuka memakai angka, padahal dokumen aslinya memakai a./b.

Daftar yang berdiri sendiri kini ikut bisa dipecah antarhalaman. Sebelumnya
hanya daftar di dalam pasal yang bisa, sehingga butir pembuka pindah utuh ke
halaman berikutnya dan meninggalkan ruang kosong sepertiga halaman.

Isi tetap utuh dan paginasinya tetap tetap: diperiksa ulang di peramban.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Samakan lebar paragraf dokumen dengan judul, daftar, dan tabelnya

Aturan antarmuka p{max-width:66ch} ikut berlaku di dalam dokumen cetak,
sehingga paragraf hanya selebar 139,7mm sementara judul, daftar, tabel pihak,
dan garis di bawah judul selebar 159,2mm. Selisih 19,5mm itulah yang terbaca
sebagai tepi kanan yang tidak rata; dan karena paragraf rata kiri di kotak yang
lebih lebar, pusatnya meleset ~10mm sehingga judul yang sebenarnya sudah di
tengah tampak tidak center.

Batas itu dicabut untuk ketiga dokumen. Surat Verifikasi Kesiapan terkena
cacat yang sama dan ikut diperbaiki, meski belum sempat terlihat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Tempat penandatanganan dikosongkan, halaman tanda tangan tanpa paraf

Tempat semula tercetak 'Jakarta', padahal ditentukan saat penandatanganan
seperti hari dan tanggalnya. Kini ruang isian, dan frasanya dijaga tidak
terpenggal supaya garis isiannya tidak terlempar sendirian ke baris berikutnya.

Kotak paraf dilewati di halaman terakhir: di situ para pihak membubuhkan tanda
tangan penuh, bukan sekadar memarafi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Angka nomor perjanjian diisi tangan, ekornya tetap dicetak

Penomoran dipakai bersama banyak jenis dokumen di luar sistem ini, jadi
urutannya tidak bisa ditentukan dari sini tanpa berisiko bentrok dengan
dokumen lain yang memakai deret yang sama. Dokumen kini mencetak
'____/EXTSKOLLA/PKS/VIII/2026' — hanya angkanya yang kosong.

Mesin penomorannya ikut dibongkar karena tidak lagi berguna: tabel
pks_penomoran, kolom nomor_urut dan nomor, serta pemesanan nomor berurutan di
dalam buat_pks. Yang tersisa hanya bulan dan tahun, dipakai menyusun ekor
nomor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Unduh PKS sebagai PDF terkunci, dirakit di server

Mencetak lewat dialog peramban masing-masing orang tidak bisa diandalkan:
margin, kop bawaan, dan penskalaan berbeda per perangkat. PDF kini dirakit di
server oleh peramban yang sama, memakai gaya dan pemecah halaman yang sama.
Berkasnya dikunci: boleh dicetak, tidak boleh disunting atau disalin. Itu
penghalang, bukan pengaman — yang mengikat tetap tanda tangan basah di atas
meterai.

Tiga cacat tertangkap saat pengujian, dua di antaranya juga merusak tombol
Cetak yang selama ini dipakai:

- Aturan cetak menyembunyikan SEMUA <header> untuk merapikan antarmuka, dan
  blok judul PKS kebetulan memakai <header>. Judul perjanjian hilang dari
  setiap hasil cetak.
- Aturan tata letak layar sempit ikut berlaku saat mencetak, karena lebar
  halaman A4 hanya 794px — di bawah ambang 860px. Kertas berubah jadi tampilan
  ponsel: isi tidak menjorok, kop cuma di atas, paraf ikut mengalir. Semua blok
  max-width kini dibatasi ke media layar.
- Tinggi kotak persis 297mm membuat kotak terakhir meluber jadi satu halaman
  kosong tambahan; dipangkas 0,2mm khusus saat cetak.

Pembantu pemecah halaman disarangkan ke dalam satu fungsi supaya utuh saat
dikirim ke peramban di server, dan penanda transpiler yang ikut terbawa
disediakan penggantinya.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Unduh PDF hanya untuk PKS yang sudah difinalisasi

Tombolnya disembunyikan selama masih draf, dan rutenya ikut menolak dengan 409.
Menyembunyikan tombol saja bukan penguncian: alamat rutenya bisa dibuka
langsung, dan draf yang belum final belum boleh beredar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Unggah PKS bermeterai, dan status PO menyusul sampai pks_ditandatangani

Alur sebelumnya berhenti di 'unduh, cetak, tanda tangan' tanpa tempat menaruh
hasilnya — sistem tidak pernah tahu sebuah kerjasama benar-benar jadi. Sales
kini mengunggah pindaian PKS bermeterai berikut tanggal yang tertulis di
dokumen, dan itulah yang menaikkan status jadi pks_ditandatangani.

Nilai enum pks_terbit dan pks_ditandatangani sudah ada sejak awal tapi tidak
pernah tersambung; finalisasi PKS kini mengisi yang pertama.

Berkasnya diunggah langsung dari peramban ke penyimpanan: pindaian belasan
megabyte, sementara badan Server Action dibatasi 1MB. Yang lewat server hanya
pencatatannya.

Izin baca berkas diikatkan ke PO-nya lewat awalan jalur, bukan sekadar
'punya peran apa pun' seperti bucket tanda tangan — isinya perjanjian
bermeterai milik sekolah.

Perpindahan status dikerjakan fungsi basis data, bukan dengan melonggarkan
po_ubah: kebijakan itu sengaja tidak mengizinkan sales menyentuh PO yang sudah
terverifikasi, dan melonggarkannya demi satu langkah membuka pintu untuk semua.

Daftar yang menyaring status 'terverifikasi' saja dilebarkan lewat
SETELAH_VERIFIKASI — tanpa itu PO menghilang dari daftarnya sendiri begitu
statusnya naik, persis yang pernah terjadi pada Antrean Verifikasi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Ringkasan tahap PKS pindah dari Daftar PO ke menu Perjanjian (PKS)

Daftar PO kini berhenti di 'terverifikasi'; sejak PKS terbit, PO beserta
ringkasannya ada di menu PKS — mengikuti pemisahan yang sama seperti
dokumennya.

Definisi statusnya ditaruh di satu berkas (lib/status-po.ts) supaya kedua menu
tidak pernah menampilkan status yang sama atau melewatkan satu pun. Di menu
PKS, 'terverifikasi' tampil sebagai 'Belum terbit': PO-nya memang terdaftar di
sana sebagai yang PKS-nya belum ada, dan tanpa chip itu jumlah chip tidak akan
sama dengan hitungan 'Semua'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Halaman Kelola Pengguna, dan akun nonaktif benar-benar ditolak

Admin Utama kini menambah akun, menyunting nama dan peran, serta menonaktifkan
dan mengaktifkan kembali — tanpa perlu lewat SQL. Menunya dikembalikan.

Akun tidak pernah dihapus. PO, tanda tangan, dan keputusan verifikasi merujuk
ke alamatnya; menghapusnya memutus jejak siapa mengerjakan apa.

CELAH YANG DITEMUKAN DAN DITUTUP: penggunaSaatIni() tidak memeriksa kolom
aktif. RLS sudah menghormatinya lewat private.peran_saya(), tapi sisi aplikasi
tidak — akun yang dinonaktifkan tetap dianggap sah, menunya muncul, pemeriksaan
peran di halaman meloloskan, dan yang terlihat hanya halaman kosong tanpa
penjelasan. Sekarang ditolak dengan pesan yang jelas.

Penjaga Admin Utama ada sebagai trigger basis data, bukan pemeriksaan halaman:
halaman bisa dilewati, dan kehilangan admin terakhir berarti tidak ada lagi
yang bisa memulihkan akses siapa pun. Menurunkan atau menonaktifkan diri
sendiri juga ditolak — bukan karena berbahaya, tapi karena tidak bisa
dibatalkan sendiri.

Nama kini wajib: dipakai sebagai penanda tangan di PO dan surat, dan baris
tanpa nama akan tampil sebagai alamat surel di dokumen resmi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Ikon web memakai logo yang sama dengan kalkulator

Berkasnya disalin apa adanya dari skolla-pricing-calculator supaya kedua alat
tampil sebagai satu keluarga di bilah tab. Ditaruh sebagai app/icon.svg —
konvensi App Router, jadi tidak perlu tag <link> sendiri.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Daftar pengguna tidak lagi terbuka untuk semua akun terdaftar

Mengubah pengguna memang sejak awal hanya Admin Utama — diuji langsung sebagai
akun sales: menambah akun ditolak, menaikkan peran sendiri tidak tersimpan,
menonaktifkan admin gagal.

Tapi MEMBACA terbuka untuk siapa pun yang terdaftar, lengkap dengan peran tiap
orang, padahal yang dibutuhkan hanya nama dan alamat akun aktif untuk dropdown
penanda tangan di form PO.

RLS bekerja per baris, bukan per kolom, jadi kolom  tidak bisa
disembunyikan lewat kebijakan. Tabelnya karena itu ditutup — hanya Admin Utama
dan pemilik barisnya sendiri — dan kebutuhan yang sah dilayani fungsi yang
mengembalikan dua kolom itu saja. Pola yang sama dengan alasan pricelist tidak
pernah masuk basis data.

Halaman surat ikut disesuaikan: ia membaca baris Tech Ops Lead untuk mengambil
namanya, baris milik orang lain yang kini tertutup.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-29 — Akun terdaftar tanpa peran tidak lagi mungkin, dan pesannya jelas

Login dengan domain benar tapi belum terdaftar sudah aman sejak awal: yang
muncul kartu Akses Belum Tersedia dengan pesan dan tombol keluar.

Yang belum tertangani adalah keadaan di antaranya: sudah terdaftar tapi
perannya kosong. Basis data menerimanya, dan orang itu lolos sebagai pengguna
sah — sidebar muncul di atas halaman-halaman kosong tanpa satu pun penjelasan,
karena RLS tidak meloloskan apa pun.

Keadaan itu kini tidak bisa ada (CHECK di basis data), dan tetap diperiksa lagi
di aplikasi dengan pesannya sendiri: sudah terdaftar tapi belum diberi peran.

Penjaga pertama tidak menggigit: array_length(larik, 1) mengembalikan NULL
untuk larik kosong, dan CHECK hanya gagal pada FALSE — bukan NULL. Tertangkap
karena penjaganya diuji, bukan diasumsikan bekerja. Diganti cardinality().

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-30 — Dashboard berisi data: filter periode, tren, komposisi, corong, proyeksi

Isinya sekarang dihitung dari data nyata, bukan nol yang ditulis tangan.
Angkanya otomatis mengikuti cakupan peran karena RLS yang menyaring barisnya.

Selain yang diminta (tren, filter tanggal, komposisi PO dan PKS), ditambahkan
dua yang menjawab pertanyaan berbeda:
- Corong tahapan: berapa PO yang PERNAH mencapai tiap tahap, dengan selisihnya
  ditandai merah — di situlah proses tersendat.
- Proyeksi penerimaan enam bulan dari jadwal termin PO yang sudah terverifikasi
  ke atas. Ini jadwal tagihan, bukan uang yang sudah masuk.

Grafiknya SVG yang dirakit di server: tanpa pustaka grafik, tanpa JavaScript di
peramban, dan tiap grafik membawa ringkasan teksnya sendiri lewat aria-label.

WARNA STATUS DIPISAH PER TEMA. Nilai tunggal tidak mungkin lolos di keduanya:
emas #F2CA17 hanya 1,54:1 di atas jalur terang dan biru tua #02219E hanya
1,54:1 di atas jalur gelap — batangnya praktis hilang. Diukur, bukan dinilai
dari mata: tujuh dari sebelas warna lama gagal 3:1 (WCAG 1.4.11), dan itu sudah
berlaku di chip status Daftar PO sejak lama, bukan cacat baru. Sepuluh pasangan
pengganti semuanya lolos di temanya masing-masing.

Grafik yang seluruh nilainya nol tidak lagi menggambar sumbu: skala dipaksa
minimal satu, jadi yang muncul angka acuan palsu.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-30 — Komposisi jadi cincin, corong jadi alur bertahap

Komposisi PO dan PKS kini lingkaran cincin dengan total di tengah dan
keterangan di sampingnya. Kategori bernilai nol tidak digambar sebagai juring —
juring setebal nol hanya menghasilkan garis yang menyesatkan — tetapi tetap
tercantum di keterangan supaya terlihat bahwa tahapnya memang kosong, bukan
terlewat.

Corong dibaca sebagai alur: tiap langkah membawa angkanya sendiri, dan di
antara langkah ada konversi dari tahap sebelumnya. Konversi di bawah 70%
ditandai merah, dan tiap kotak menyebut berapa yang berhenti di situ.
Persentase terhadap langkah pertama sengaja tidak ditonjolkan: yang bisa
ditindaklanjuti adalah kebocoran antar dua tahap berdekatan, bukan sisa dari
awal.

Alurnya menumpuk di layar sempit, dan dibungkus wadah bergulir sebagai jaring
pengaman supaya halaman tidak pernah bergulir mendatar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-30 — PKS Funnel, filter tanggal spesifik, dan angka rinci saat kursor menyentuh grafik

- Corong Tahapan diganti PKS Funnel.
- Keterangan panel berhenti di tengah kotak karena aturan umum p{max-width:66ch}
  ikut berlaku di dalamnya — batas itu dicabut untuk keterangan panel. Ini
  kebocoran yang sama seperti pada dokumen cetak, hanya di tempat lain.
- Rentang tanggal khusus lewat formulir GET biasa: rentangnya tersimpan di
  alamat sehingga bisa ditandai dan dibagikan, dan tetap jalan tanpa JavaScript.
  Rentang khusus menang atas pilihan cepat; keduanya wajib terisi supaya tidak
  menggantung di satu sisi.
- Batang dan juring menampilkan angka rincinya saat disentuh kursor. Pusat
  cincin ikut berganti ke nilai juring yang sedang disorot. Setiap bentuk juga
  membawa <title> bawaan SVG, jadi di perangkat sentuh dan tanpa JavaScript
  keterangannya tetap didapat.

rp dan rpSingkat dipindah ke lib/format.ts. Keduanya tadinya ikut di dalam
berkas yang kini bertanda 'use client', dan mengimpornya ke Server Component
memberi rujukan klien alih-alih fungsinya — gagal saat berjalan, bukan saat
dibangun.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-30 — Rapikan baris filter, dan angka KPI tidak lagi terpotong

Pilihan cepat di kiri, rentang tanggal di pojok kanan sebagai satu kendali
berbingkai — bukan empat kotak yang kebetulan berdampingan. Tingginya
disamakan dengan chip (44px) supaya barisnya duduk pada satu garis.

Sambil merapikan, ketahuan angka nilai PO terpotong jadi 'Rp1.897.000.00' di
lebar 880px. Percobaan pertama membiarkannya turun baris, tapi hasilnya lebih
buruk: '0' sendirian di baris kedua lebih menyesatkan daripada terpotong.
Angkanya kini dijaga utuh satu baris dan mengecil mengikuti lebar layar.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## 2026-08-30 — Sidebar jadi menu burger di layar sempit, dan filter tanggal dirapikan

Di layar lebar tidak ada yang berubah. Di layar sempit muncul bilah yang
menempel di atas walau halaman digulir, dengan tombol untuk membuka menu.

Panelnya menutupi isi, bukan mendorongnya: mendorong isi membuat posisi bacaan
melompat setiap kali menu dibuka. Ada tirai di belakangnya untuk menutup, panel
menutup sendiri saat berpindah halaman, dan Escape juga menutupnya.

Filter tanggal di ponsel tadinya membungkus berantakan — empat kendali sebaris
tidak muat. Kini kisi: label di kiri, isian mengisi sisanya, tombol selebar
penuh.

Perkakas pratinjau ponsel ditambahkan (uji/pratinjau-ponsel.mjs). Perender
pratinjau tidak mengecil mengikuti viewport sehingga @media (max-width) tidak
pernah menyala di sana; perkakas ini menyalin isi blok sempit menjadi aturan
tanpa syarat supaya tata letaknya benar-benar bisa dilihat.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

