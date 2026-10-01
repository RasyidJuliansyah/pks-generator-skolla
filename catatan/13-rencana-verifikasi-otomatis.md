# Rencana: Verifikasi Otomatis PO menurut IoM

Status: **rencana**, belum dieksekusi. Disusun 15 Sep 2026.
Bahan acuan: `catatan/11` (wizard), `catatan/08` (ekstraksi scan), `catatan/04`
(peran & keamanan), `catatan/05` (penahan). Seluruh rujukan berkas di bawah bisa
dicek di repo ini.

## Tujuan

Untuk PO yang **isiannya sesuai dengan aturan IoM yang bisa diperiksa mesin**,
sistem memverifikasi sendiri dan langsung menyusun draf PKS. PO yang tidak
memenuhi (atau butuh penilaian manusia) masuk ke **antrean verifikasi manual
yang dijawab langsung Head of Operations**, dengan daftar alasan kenapa tidak
lolos otomatis sudah terisi lebih dulu.

Inisiatif ini bukan "menggantikan verifikasi", melainkan menaruh **gerbang
aturan** di depan, dan hanya jalur yang benar-benar objektif yang dilewatkan
mesin. Sisanya tetap manusia, tapi tidak lagi dari nol.

## Yang SUDAH ada di repo (fakta, dengan rujukan)

1. **Aturan isi sudah sebahagian ditegakkan saat simpan** (`lib/po-aksi.ts`,
   `periksa()` hal.113-172): nama sekolah wajib, komponen harus dikenal,
   jumlah siswa minimal 1, batas minimal peserta & kapasitas sesi
   (`lib/aturan-komponen.ts`: `MIN_PESERTA`, `KAPASITAS_SESI`), lantai bottom
   price, dan **Σ termin = grand total** (hal.166-169).
2. **Lantai bottom price sudah ada di basis data** (`supabase/migrasi/
   20260909_lantai_harga_di_basis_data.sql`): tabel `harga_komponen`,
   `harga_paket`, `pricelist_aktif`; fungsi `private.lantai_siswa(p_po)` dan
   `private.lantai_guru(p_po)` menghitung lantai per PO dalam SQL. ACQUISITION
   PRICE **tidak pernah** masuk DB.
3. **Penjaga penutupan verifikasi** (`jaga_penutupan_verifikasi`, trigger
   `po_jaga_penutupan`): ke `terverifikasi` butuh ≥4 hijau dan 0 tolak dari
   tabel `verifikasi`; ke `ditolak` butuh ≥1 tolak.
4. **Verifikasi 4 fungsi** (`lib/checklist.ts`): education, tech_ops, finance,
   service_account; 16 butir total. Wilayah per fungsi di `WILAYAH`, reset
   selektif lewat `fungsiTerdampak` + `basikan_verifikasi`.
5. **Terakhir hanya manusia yang menutup**: `tutupVerifikasi` memerlukan
   `adalahLead` = peran `tech_ops_lead` (`lib/supabase-server.ts:138`).
6. **PKS**: `buatPks` (RPC, memesan nomor, `lib/pks-aksi.ts`) kemudian
   `finalisasiPks` (mengunci, status naik ke `pks_terbit`). Nomor yang dibatalkan
   tidak dipakai ulang (`batalkanPks`).
7. **Isi PO dibekukan begitu meninggalkan draf** (`bekukan_isi_po`): harga,
   masa, rombel mustahil berubah sesudahnya; lantai diperiksa tepat sekali pada
   transisi keluar draf. Ini yang membuat verdict otomatis stabil.
8. **Poin PO unggahan**: wajib ada pindaian + pernyataan "sesuai dengan scan"
   (`ditinjau_oleh`/`ditinjau_pada`), ditegakkan RPC `ajukan_po_unggahan`.

## Yang TIDAK bisa dipastikan mesin (harus jujur)

Sebanyak **10 dari 14 butir wajib** checklist verifikasi adalah penilaian, bukan
perhitungan:

- Education `a1` kurikulum / `a2` materi sesuai level / `a3` konten lolos QC.
- Tech Ops `b1` fitur tanpa bug kritikal / `b2` severity bug / `b3` integrasi.
- Finance `d3` status pajak / `d4` dokumen sponsorship (bila ada).
- Service Account `c2` tim support siap / `e3` PIC layanan / `e4` checklist bulanan.

Yang **bisa** dipastikan mesin: `d2` termin total = nilai PO, dan `e2` min peserta
& kapasitas. Dua butir penuh, ditambah **separuh** `d1`: yang ditegakkan baru lantai
bottom price, sedangkan kesesuaian dengan price_list tidak pernah dibandingkan
dengan harga yang tersimpan (`lib/po-aksi.ts:156` memakai `perSiswa[1]`). Butir
`e1` daftar layanan sesuai PO **tidak punya aturan yang setara sama sekali**. Jadi
yang benar-benar bisa mesin hari ini **tiga butir**, bukan empat. Rincian dan bukti
kodenya di `13a` Bagian 4 dan 5.

**Konsekuensi yang menentukan lebar inisiatif ini:** PO tidak akan pernah bisa
lolos otomatis selama butir-butir penilaian itu tetap diwajibkan per PO. Jadi
inti keputusan Fase 0 adalah menetapkan **deklarasi kesiapan berdiri sendiri
per produk/paket** (kesiapan konten & produk dihitung sekali untuk satu versi
produk, bukan per PO). PO kelas standar tanpa permintaan fitur hanya mengecek
sisanya secara mesin; bila deklarasi produknya belum ada atau PO menyimpang,
langsung manual.

## Keputusan yang diusulkan (rekomendasi ditandai)

| Hal | Keputusan | Rekomendasi |
|---|---|---|
| Lebar | Gerbang aturan Ts murni, deterministik; tanpa model AI untuk menilai butir subjektif | Setuju |
| Akuntabilitas | Verdict sistem dicatat terpisah dari keputusan manusia | Tidak menaruh "lampu hijau" atas nama fungsi manusia; verdict di tabel sendiri |
| Terbit PKS | Auto-draf dulu; terbit tetap klik manusia | **Auto-draf** (Fase 4), auto-finalisasi hanya setelah diukur |
| Penutup manual | PO eskalasi ditutup Head of Operations | Beri HoO wewenang tutup **hanya** untuk PO eskalasi; `tech_ops_lead` untuk jalur rutin |
| Surat | Nama yang tercetak di Surat Verifikasi Kesiapan untuk PO auto | Nama HoO sebagai penanggung jawab, dengan keterangan "diverifikasi otomatis IoM vX" |
| Versioning | Tiap verdict dicap `versi_iom` + `versi_po` | Setuju |
| Evaluasi gagal | Aturan aneh/gagal = manual, bukan lolos | fail-closed |

## Prinsip yang tidak boleh dilanggar

- **Penjagaan di basis data, bukan tampilan** (`catatan/04`). Verdict otomatis
  ditulis RPC yang memeriksa status & versi sendiri; hanya boleh dipanggil saat
  `status='verifikasi'` dan `versi` cocok. Jangan buka jalur langsung ke tabel
  lewat PostgREST.
- **Acquisition Price tidak pernah ke DB** (`catatan/01`, migrasi lantai).
  Aturan yang butuh acquisition tetap di kode TS; yang butuh price list/bottom
  boleh menghitung ulang di DB seperti `lantai_siswa`.
- **Butir penilaian tidak pernah "dikira pasti"** dengan angka rekaan.
- **Verdict ikut versi** (`versi_po`): PO yang direvisi harus dievaluasi ulang;
  verdict lama tidak berlaku (pola `fungsiTerdampak`).
- **Fail-closed**: bila evaluasi aturan melempar galat, PO ke antrean manual.
- **Setiap perubahan skema diuji dalam transaksi yang dibatalkan** dengan
  simulasi peran (boleh DAN dilarang), mengikuti `supabase/README.md`.
- Tampilan menaati `DESIGN.md`: tanpa tanda pisah "—", tanpa ikon/emoji baru,
  dua tema, target sentuh ≥44px di ≤520px.

## Fase 0. Bekukan aturan IoM (manusia, TANPA kode) — PENGHALANG

> Semua fase sesudah ini tidak bisa tepat tanpa daftar aturan yang disetujui
> Rizki. Jangan mulai Fase 1 sebelum Fase 0 tuntas.

> **Aturannya DITETAPKAN RESMI 17 Sep 2026 sebagai `iom-2026-09-17`** (Rizki,
> disetujui apa adanya). Deklarasi kesiapan ketujuh paket juga ditandatangani 17 Sep
> 2026 (kesepuluh butir, berlaku 6 bulan sampai 17 Mar 2027; rinciannya di `13a`
> Bagian 3). **Fase 0 TUNTAS 17 Sep 2026:** `pricelist_aktif.versi` di produksi sudah
> `af4fc50e4ac9` (sama dengan kode), dan ketujuh nama paket di `harga_paket` produksi
> cocok dengan tabel deklarasi. Fase 1 boleh dimulai. Tinjauan legal UU PDP tetap
> menahan PO sungguhan masuk, bukan pembangunannya.
>
> **Drafnya sudah ada dan keputusannya sudah diambil: `catatan/13a-aturan-iom.md`**
> (16 Sep 2026). Rizki memutuskan kelima butirnya pada hari yang sama; rinciannya
> di `13a` Bagian 6. Dua koreksi terhadap dokumen ini ditemukan saat menyusunnya:
> `d1` belum benar-benar bisa diperiksa mesin (yang ditegakkan baru lantai, bukan
> kesesuaian dengan pricelist), dan `e1` tidak punya aturan yang setara sama sekali.
> Jadi yang bisa mesin hari ini **tiga butir**, bukan empat.
>
> **Amandemen 16 Sep 2026:** keputusan E menambah peran kedua untuk Head of
> Operations. Lihat catatan di Fase 3 di bawah.

1. Susun `catatan/13a-aturan-iom.md`: tabel aturan dengan kolom
   `kode + teks + wajib/tidak + fungsi wilayah + kondisi + bukti(dari kolom DB) + sejak».
2. Tetapkan **deklarasi kesiapan produk/paket** (dari `a1-a3`, `b1-b3`, `c2`,
   `e3`, `e4`): per produk/versi paket mana yang dianggap siap, oleh siapa,
   kapan diverifikasi. PO kelas standar menunjuk deklarasi itu.
3. Tentukan **kelas PO yang mangkus untuk otomatis**: platform (bukan
   unggahan) atau unggahan dengan `ditinjau` dan TANPA pengecualian HoO, TANPA
   sponsorship/hibah, TANPA deviasi harga. Sisanya wajib manual.
4. Putuskan soal **permintaan fitur**: di aplikasi ini tidak ada fungsi
   TechDev; butir `b4` (opsional) yang menampungnya. Tentukan apakah permintaan
   fitur membuat PO tidak boleh lolos otomatis (disarankan: ya, wajib manual).
5. Rizki menandatangani aturan itu. Ini "IoM" yang akan dicap di setiap verdict.

**Prasyarat (bukan kode):** legal meninjau kalimat pada Surat Verifikasi untuk
PO auto (`catatan/05` butir 1 menahan seluruhnya); cek nilai `pricelist_aktif.versi`
di produksi (di migrasi masih `'belum diisi'`).

## Fase 1. Mesin aturan murni: `lib/iom.ts` (TDD)

> **TAYANG 17 Sep 2026** (rencana rinci: `catatan/14`). Mesin `lib/iom.ts` (belum
> disambungkan), migrasi `20260917_syarat_maju_iom` diterapkan ke produksi atas
> persetujuan Rizki (bukti 13/13 kasus + mutasi, ulang hidup 11/11), dan kotak centang
> permintaan tambahan di wizard. QA independen PASS tanpa BLOCKER/MAJOR. Tindak lanjut
> MINOR dari QA: (1) uji `iom` belum menyapu sisi gagal `lantai-guru`, tiap isian
> `sekolah-lengkap`, masa terbalik, dan unggahan tanpa berkas; (2) Fase 2 wajib mengoper
> hanya deklarasi versi TERKINI per produk ke `nilai()` (pencarian memakai `produk` saja);
> (3) baris termin bertanggal tapi bernominal 0 membuat pesan "Total termin Rp0 belum
> sama..." alih-alih "Termin pembayaran belum diisi." (tetap menolak); (4) kontras bingkai
> kotak centang tema gelap ~1,35:1, bawaan sebelum perubahan ini.

**Tujuan:** satu fungsi murni yang menilai PO dari sebuah faksi data, bebas
dari DB dan klien.

- `lib/iom.ts` — modul `'server-only'`, `import { ... } from './hitung'`,
  `./aturan-komponen`, `./kelengkapan-po`. TIDAK mengimpor `pricelist` nilai
  acquisition (jaga `uji/batas-harga.test.mjs`).
- `VERSI_IOM = 'iom-2026-09-15'` (atau dari Fase 0).
- `type FaktaPo` — bentuk PO yang dibaca aplikasi (harga, grand_total, termin,
  komponen, rombel, jumlah, sumber_dana, asal, masa, kelompok, catatan sponsorship).
- `type Aturan = { kode; fungsi; wajib; teks; periksa(f)->{lolos;bukti} }`.
- `aturanAwal(): Aturan[]` — katalog contoh yang SUDAH terverifikasi di repo:
  `lantai-siswa`, `lantai-guru`, `termin-sama-total`, `minimal-peserta`,
  `kapasitas-sesi`, `komponen-dikenal`, `masa-aktif-wajar`, `sekolah-lengkap`,
  `unggahan-ditinjau` (bila asal unggahan), `tanpa-sponsorship`.
- `nilai(f): { lolos; wajibGagal: string[]; hasil: {kode;lolos;bukti}[] }`.
  `lolos`= true hanya bila TIDAK ada wajib yang gagal (ignore singkat wajib).
- Galat apa pun yang dilempar `nilai()` dianggap `lolos=false` pada pemanggil.

**Task:**
1. Tulis `uji/iom.test.mjs` (kasus fakta PO rekaan: lolos penuh, gagal lantai,
   gagal termin, gagal min peserta, unggahan belum ditinjau, sponsorship).
   Jalankan → harus gagal (modul belum ada).
2. Tulis `lib/iom.ts` minimal sampai semua lolos.
3. Uji mutasi: seret nilai harga acquisition lewat impor → `batas-harga` ikut
   jaga; sadap `nilai()` supaya silent-fail jadi `manual`.
4. `npm run periksa`.

## Fase 2. Verdict di basis data (migrasi + RPC)

> **Keputusan Rizki 17 Sep 2026 yang MENGGANTIKAN rancangan di bawah** (rencana rinci:
> `catatan/15`). (1) Verdict dihitung basis data sendiri oleh trigger saat PO masuk
> `verifikasi`, dari data basis data, bukan dikirim aplikasi ke RPC: RPC yang menerima
> `p_lolos` bisa dipanggil siapa pun lewat PostgREST dan verdictnya bisa dipalsukan.
> `lib/iom.ts` tetap sebagai rujukan teruji; kesamaan aturannya dijaga uji statis dan bukti
> dibatalkan. (2) PO yang lolos otomatis TIDAK ditutup sendiri: Head of Operations menutupnya
> dengan satu klik (RPC `tutup_verifikasi_otomatis`), dan `diverifikasi_oleh` mencatat orang
> yang benar-benar menutup. (3) Deklarasi kesiapan diisi migrasi sekarang; layar tanda tangan
> ulang dibangun sebelum 17 Mar 2027.
>
> **TAYANG DI PRODUKSI 17 Sep 2026** (atas persetujuan Rizki): migrasi `20260917b_verdict_iom`,
> `20260917c_tutup_verifikasi_otomatis`, `20260917d_urutan_status_po`. QA independen tiga
> putaran sebelum diterapkan: putaran 1 FAIL (PO bisa melompat ke `verifikasi` tanpa tanda
> tangan; admin_utama lolos cek HoO; deklarasi tidak dicek ulang saat menutup), putaran 2 FAIL
> (tanda tangan putaran lama terbawa; PO unggahan lewat `menunggu_ttd`), putaran 3 PASS.
> Bukti hidup sesudah diterapkan 14/14. Keadaan: 7 deklarasi, 0 verdict (PO yang sudah di
> `verifikasi` tidak dinilai surut). Aplikasi belum berubah: antarmuka di Fase 3.

Satu migrasi baru di `supabase/migrasi/<tgl>_verifikasi_otomatis.sql`, diuji
dalam transaksi dibatalkan dengan `set role authenticated` (boleh = RPC,
dilarang = insert/update langsung tabel).

Server `catat_verdict_otomatis(p_po, p_versi_iom, p_lolos, p_wajib_gagal text[],
p_hasil jsonb)`:
- ke `terverifikasi` TIDAK langsung di sini. Fungsi ini hanya menulis verdict;
  penutupnya terpisah di Fase 3/Fase 4.
- memeriksa `po.status='verifikasi'` dan `po.versi = versi saat ini`; menolak
  bila verdict lama yang masih berlaku untuk `versi` yang sama.
- `security definer`, `set search_path to public`.

Tabel `verifikasi_otomatis`:
- kolom: `po_id uuid references po`, `versi_iom text`, `versi_po int`,
  `lolos bool`, `wajib_gagal text[]`, `hasil jsonb`, `dicatat_pada timestamptz`,
  `diverifikasi_manual bool default false`.
- `primary key (po_id, versi_po)`; RLS dibuka untuk tidak ada yang bisa
  membaca/menulis langsung (kecuali fungsi SECURITY DEFINER) — sama seperti
  tabel harga.
- Amandemen **sempit** `jaga_penutupan_verifikasi`: bila
  `exists (select 1 from verifikasi_otomatis where po_id=new.id and versi_po=new.versi and lolos)`
  maka transisi ke `terverifikasi` diizinkan tanpa 4 hijau manusia. Transisi
  `ditolak` tetap butuh tolak manusia.

**Task:**
1. Tulis migrasi `…_verifikasi_otomatis.sql` + trigger + RPC.
2. Uji dalam `begin; … rollback;` dua sisi (boleh/dilarang), lengkap dengan
   komentar alasan (pola migrasi keamanan yang ada).
3. Tambah `uji/iom-db.test.mjs` yang mengeksekusi SQL simulasi (ini butuh
   basis data; ikuti pola `uji/harga-db.test.mjs` bila sudah menyentuh DB).
4. Nyalakan `pricelist_aktif.versi` (nilai IoM) sebagai kunci konsistensi.

## Fase 3. Menjalankan + antrean Head of Operations

> **Masukan dari Fase 2 (17 Sep 2026)** yang wajib ikut Fase 3: (1) verdict SUDAH dihitung basis
> data, aplikasi hanya membaca `verifikasi_otomatis` (baris terakhir per PO) dan memanggil RPC
> `tutup_verifikasi_otomatis` untuk HoO; bagian "server action jalankanVerifikasiOtomatis" di
> bawah tidak lagi diperlukan. (2) `kirimUntukTtd` perlu menghapus berkas gambar tanda tangan
> putaran lama di storage (`{id}/{pihak}.png`) sesudah lompatan status berhasil; trigger hanya
> menghapus barisnya. (3) Layar tanda tangan ulang deklarasi kesiapan harus ada SEBELUM
> 17 Mar 2027; sesudah tanggal itu semua PO kembali manual. (4) Surat Verifikasi Kesiapan untuk
> PO otomatis ditandatangani HoO (perluasan `leadSaatIni()`). (5) Pesan galat baru dari
> `po_urutan_status` sampai ke Sales lewat `galat` yang sudah ditampilkan panel.
>
> **Keputusan Rizki 17 Sep 2026 soal Fase 3:** dipecah tiga. **3a** (rencana `catatan/16`):
> kartu verdict di halaman PO, antrean HoO + tombol tutup satu klik, hapus berkas tanda tangan
> lama saat kirim ulang. **3b** SESUDAH legal menyetujui kalimat Surat untuk PO otomatis: HoO
> menandatangani Surat (butuh ubah kebijakan RLS `surat_verifikasi` dan storage `surat/%` yang
> kini hanya `tech_ops_lead`). Sampai 3b, Surat untuk PO otomatis DIBLOKIR (kalimat "dari sisi
> fungsi yang memutuskan" kosong), jadi PO otomatis berhenti di `terverifikasi` sebelum PKS.
> **3c** sebelum Feb 2027: layar tanda tangan ulang deklarasi. PO yang lolos otomatis
> DISEMBUNYIKAN dari antrean keempat fungsi; HoO melihatnya di menu Antrean Verifikasi, bagian
> "Lolos otomatis, menunggu penutupan".
>
> **CACAT YANG BELUM ADA SAAT ITU:** keputusan 22 Sep 2026 (catatan/13a Bagian 11) mengubah
> bagian ini. Penutupan HoO satu klik beserta antreannya DIHAPUS: PO yang lolos naik sendiri ke
> `terverifikasi`, dan Surat Verifikasi Kesiapan-nya terbit serta terkunci otomatis. **3b tidak
> jadi dikerjakan** — bukan karena legal menyetujui kalimatnya, melainkan karena suratnya
> berganti bentuk: yang mengkonfirmasi sistem, dan HoO + Tech Ops Lead hanya diinformasikan.
> Kalimat baru itu tetap perlu ditinjau legal (`catatan/05`). **3c** (layar tanda tangan ulang
> deklarasi sebelum Feb 2027) tetap berlaku dan belum dikerjakan.
>
> **3a TAYANG DI PRODUKSI 17 Sep 2026** (tanpa perubahan basis data). QA independen tiga putaran:
> putaran 1 FAIL (layar menyebut "lolos" untuk PO yang ditolak trigger penutupan: ada penolakan,
> versi IoM lama, deklarasi kedaluwarsa; PO itu lenyap dari antrean fungsi), putaran 2 FAIL (PO
> buatan satu-satunya HoO tidak bisa ditutup siapa pun), putaran 3 PASS. Aturan yang lahir dari
> situ: pembagian antrean di aplikasi WAJIB mencerminkan setiap syarat trigger dan RPC penutupan
> (`lib/verdict-iom.ts`, keadaan `tertahan`); yang tidak bisa ditutup HoO tetap ke keempat fungsi.
> Surat PO otomatis ditahan di aksi tanda tangan dan finalisasi (aplikasi saja; kebijakan basis
> data menyusul di 3b). Chunk publik produksi bersih dari angka khas Acquisition.

Server action `jalankanVerifikasiOtomatis(poId)` (`lib/iom-aksi.ts`):
1. baca fakta PO dari DB (pakai `wajib()` untuk kueri baca baru, `uji/kueri-baca`),
2. panggil `nilai()`; galat → lolos=false,
3. `away` memanggil `catat_verdict_otomatis(...)` hanya bila status versi cocok.

Perilaku:
- `lolos` → RPC tutup (lihat Fase 4) saat `ayan`, status `terverifikasi`,
  `diverifikasi_oleh='sistem:iom-'+VERSI_IOM`, `diverifikasi_pada=now()`.
  **Nilai `diverifikasi_oleh` di baris ini KELIRU dan sudah dicabut** — lihat catatan
  pencabutan di Fase 3 dan `13a` Bagian 11: kolomnya ber-foreign key ke `pengguna(email)`,
  jadi penutupan otomatis mengosongkannya. Rancangan lain di blok ini (badge otomatis vs
  manual, `diverifikasi_manual`, `butuh_ops`) juga sudah tidak dipakai apa adanya.
- `!lolos` → PO tetap `verifikasi`, ditandai `butuh_ops`, dengan `wajib_gagal`.
  Bagian "Antrean Verifikasi" dan halaman `po/[id]` menampilkan kartu
  "Perlu verifikasi manual (Ops)" dengan bukti tiap aturan yang gagal.
- UI memakai badge terang-gelap tersendiri untuk "otomatis" vs "manual"
  (`DESIGN.md`); tanpa emoji.

Siapa menutup manual: perluas `adalahLead`? Tidak. Tambah jalur
`tutupVerifikasi` yang mengizinkan `head_of_operations` hanya untuk PO yang
`diverifikasi_manual=true`. `tech_ops_lead` tetap untuk jalur rutin.

> **Amandemen 16 Sep 2026 (keputusan E di `13a`).** Paragraf di atas menetapkan HoO
> menutup **hanya** PO eskalasi manual. Rizki menambah peran kedua untuk HoO: ia
> juga **mencetak namanya dan menandatangani Surat Verifikasi Kesiapan** untuk PO
> yang lolos otomatis. Jadi HoO memegang dua jalur, bukan satu.
>
> Konsekuensi teknis: penjagaan `simpanTtdSurat()` dan `finalisasiSurat()`
> (`lib/surat-aksi.ts`, keduanya memakai `leadSaatIni()` yang hanya menerima
> `tech_ops_lead`) harus diperluas **khusus untuk PO yang lolos otomatis**.
> `tech_ops_lead` tetap untuk jalur rutin.
>
> Dan `diverifikasi_oleh` untuk PO otomatis harus diisi **email HoO**, bukan
> `sistem:iom-...`. Rantai nama di `app/(sistem)/po/[id]/surat/page.tsx:54-58`
> mencari nama lewat `daftarPengguna()` berdasarkan email, jadi string `sistem:`
> tidak akan ketemu dan surat tercetak dengan nama `'-'`. Cap "diverifikasi
> otomatis IoM vX" disimpan di kolom `versi_iom` yang terpisah.
>
> **DICABUT 22 Sep 2026 — jangan diikuti.** Kedua paragraf di atas berlaku untuk
> penutupan satu-klik, yang sudah DIHAPUS (`catatan/13a` Bagian 11). `diverifikasi_oleh`
> sekarang **dikosongkan** untuk PO otomatis, dan itu bukan pilihan gaya: kolomnya
> ber-FOREIGN KEY ke `pengguna(email)`, jadi baik `'sistem:iom-...'` (yang dulu
> disarankan di paragraf di atas) MAUPUN nilai bukan-email lain akan ditolak basis data
> dan membatalkan seluruh transaksi pengajuan verifikasi Sales. Rantai nama di halaman
> surat juga tidak lagi dipakai untuk PO otomatis: varian suratnya menyebut "Sistem
> Skolla" dan tidak memakai `nama_penanda`.

**Task:**
1. `lib/iom-aksi.ts` + integrasi ke panel `po/[id]` dan `/verifikasi/page.tsx`.
2. Saring dua antrean di `/verifikasi`: otomatis vs manual-HoO.
3. Jailangkan peran penutup manual ke HoO untuk PO eskalasi (`lib/supabase-server.ts`).
4. `uji/iom-aksi` (bila pakai Server Action ter-simulasi) + potret terang/gelap
   (`uji/tangkap-layar.mjs`, `pratinjau-wizard.tsx` pola).

> **Amandemen 17 Sep 2026, sebelum 3b:** sponsorship tidak lagi selalu manual. Nilainya dicatat
> dan dibatasi 15% dari grand total (aturan `sponsorship-dalam-batas`, versi `iom-2026-09-17c`),
> dan dokumennya dikonfirmasi Finance di tahap PKS. Spesifikasi: `catatan/18`; aturan: `13a`
> Bagian 8. Dikerjakan sebelum ekstraksi scan (`catatan/17`).

## Fase 4. Draf PKS otomatis (tergerbang)

> **SEBAGIAN TERWUJUD 22 Sep 2026** (catatan/13a Bagian 11). Yang diselesaikan bukan
> `buatPks` otomatisnya, melainkan gerbangnya: PO yang lolos IoM naik sendiri ke
> `terverifikasi` DAN suratnya terbit terkunci otomatis, jadi PKS sudah boleh dibuat tanpa
> langkah manusia apa pun sebelum klik Sales. `buatPks` sengaja TETAP satu klik manusia —
> peringatan di bawah (nomor PKS terbakar oleh revisi) masih berlaku penuh, dan sekarang
> lebih sering: PO otomatis mencapai `buatPks` lebih cepat. Auto-finalisasi tetap belum
> dikerjakan.

- Begitu `terverifikasi` (otomatis), panggil `buatPks(poId)` otomatis: draf PKS
  muncul dan nomor terpesan ("langsung keluar PKS"). `finalisasiPks` TETAP
  manusia sampai terukur.
- **Peringatan terukur:** tiap PO auto yang telanjur terverifikasi lalu
  direvisi akan membakar nomor PKS (`batalkanPks` tidak memakai ulang nomor).
  Pertimbangkan menyimpan verifikasi otomatis tapi MENUNDA `buatPks` sampai HoO
  meng-klik "Terbitkan draf PKS" — ini memisahkan "lolos sistem" dari
  "nomor PKS terpakai".
- Rekomendasi: **auto-verifikasi + tombol terbit satu klik oleh HoO**, bukan
  auto-`buatPks` tanpa klik. Ukur dulu dengan 20-30 PO 0 salah sebelum otomatis
  penuh.

**Task:** tombol HoO "Terbitkan draf PKS" di panel PO (aksen kecil), dan Jalur
negatif bila `finalisasi` gagal (tetap `terverifikasi`, tidak hilang).

## Fase 5. QA, deploy, catatan

1. QA independen: tinjau `git diff <sebelum>..HEAD` terhadap aturan IoM Fase 0;
   larang membaca `.env*`.
2. Verifikasi: `npm run periksa`, `npm run build`, `uji/pindai-bundel.mjs`,
   `uji/batas-harga.test.mjs`.
3. Cadangkan `.env.local`, `vercel deploy --prod --yes`, cek.
4. Rekam status & hasil QA di `catatan/11` (atau catatan baru) dan commit,
   mengikuti jejak wizard (`catatan/12`).

## Uji (ringkasan)

- `uji/iom.test.mjs` (murni), mutasi aturan, `uji/batas-harga` tetap berdiri.
- Migrasi DB: transaksi dibatalkan, dua sisi peran, komentar alasan.
- `npm run periksa`, `npm run build`, pindai bundel, potret dua tema.
- QA independen sebelum deploy; brief melarang membaca `.env*`.

## Risiko dan mitigasi

| Risiko | Mitigasi |
|---|---|
| Salah lolos = kontrak salah | Fail-closed, verdict teraudit, deklarasi produk yang disetujui HoO |
| PKS auto = dokumen kontrak tanpa mata manusia | Auto-draf + terbit satu klik; auto-finalisasi hanya setelah terukur |
| Verdict basi saat PO direvisi | `pk(po_id, versi_po)`, verdict lama tidak berlaku; dirancang sejak awal |
| Nomor PKS terbakar oleh revisi | Menunda `buatPks` sampai klik HoO (Fase 4) |
| Butir subjektif "dikira pasti" | Tidak pernah; hanya deklarasi produk yang menutupinya |
| Migration tidak bisa dijalankan ulang | Tapi skema migrasi masih di cloud (`supabase/README.md`); ikuti disiplin transaksi |

## Pertanyaan terbuka (harus dijawab sebelum Fase 1)

1. Apakah dokumen IoM lengkap tersedia (matrix aturan) untuk dibekukan di Fase 0?
   Tanpa itu, aturan awal hanya yang sudah terbukti di repo.
2. Deklarasi kesiapan produk/paket (pengganti `a1-a3`, `b1-b3`, `e4`, dst):
   dibuat oleh siapa, dan apakah Rizki setuju bentuknya "sekali per versi produk"?
3. Tercatat/kencang: untuk PO otomatis, nama siapa yang tercetak di Surat
   Verifikasi Kesiapan? (Rekomendasi: HoO + keterangan otomatis IoM vX.)
4. Scope: gerbang ini untuk aplikasi `skolla-kerjasama` saja, atau juga
   digunakan tracker Sakura (yang punya fungsi set berbeda: Edu/TechDev/TechOps)?
5. Penutup manual: setuju `head_of_operations` hanya untuk PO eskalasi, dan
   `tech_ops_lead` tetap untuk jalur rutin?