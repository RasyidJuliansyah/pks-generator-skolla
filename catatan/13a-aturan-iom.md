# Aturan IoM: draf untuk dibekukan

Status: **DITETAPKAN RESMI sebagai `iom-2026-09-17`, disetujui Rizki 17 Sep 2026
apa adanya; diamandemen hari yang sama menjadi `iom-2026-09-17b` (Bagian 7), lalu
`iom-2026-09-17c` (Bagian 8, sponsorship), lalu `iom-2026-09-22` (Bagian 9, PO
berkelompok boleh otomatis), lalu Bagian 10 (pembuat PO boleh menutup).** Keputusan Fase 0 (A sampai E) diambil 16 Sep 2026. Disusun 16 Sep 2026
sebagai isi Fase 0 `catatan/13-rencana-verifikasi-otomatis.md`. Yang masih kosong
di Bagian 3 (daftar deklarasi produk) diisi terpisah dan tidak mengubah versi aturan.

**Cara memakai dokumen ini.** Kolom "kondisi" dan "bukti" diisi dari kode dan
migrasi yang ada di repo ini. Keputusan A sampai E sudah tercatat di tempatnya
masing-masing, dan ringkasannya ada di Bagian 6.

**Yang masih kosong dan memang harus tetap kosong sampai Rizki mengisinya:**
daftar produk beserta butir-butir yang dideklarasikan (Bagian 3). Saya tidak
mengisinya dengan tebakan supaya dokumen ini terlihat lengkap.

---

## Bagian 1. Aturan yang sudah terbukti di repo

Kesembilan aturan ini sudah ditegakkan kode hari ini. Isinya bukan usulan baru,
hanya diangkat ke satu tabel supaya bisa dibekukan sebagai satu versi.

| Kode | Teks aturan | Wajib | Fungsi wilayah | Kondisi lolos | Bukti (sumber di repo) | Sejak |
|---|---|---|---|---|---|---|
| `sekolah-terisi` | Nama sekolah wajib terisi | wajib | Education, Tech Ops | `sekolah.nama` tidak kosong | `lib/po-aksi.ts` `periksa()` | 29 Agu 2026 (`a6f0f1e`) |
| `komponen-dikenal` | Setiap komponen yang dipilih harus dikenal pricelist | wajib | Education, Tech Ops | semua `po_komponen.komponen_id` ada di `harga_komponen.id` | `lib/po-aksi.ts` `periksa()`, tabel `harga_komponen` | 29 Agu 2026 (`a6f0f1e`) |
| `minimal-peserta` | Jumlah peserta per komponen memenuhi batas minimal | wajib | Service Account, Education | siswa ≥ `MIN_PESERTA` untuk komponen siswa; guru ≥ 10 untuk `guruOff`/`guruOn` | `lib/aturan-komponen.ts` `MIN_PESERTA`, `lib/hitung.ts` `langgarMinimum()` | 29 Agu 2026 (`57cccaf`) |
| `kapasitas-sesi` | Jumlah peserta tidak melebihi kapasitas sesi | wajib | Service Account | siswa ≤ 30 per sesi untuk `psiOn`/`psiOff`; guru ≤ 30 per sesi | `lib/aturan-komponen.ts` `KAPASITAS_SESI`, `langgarKapasitas()` | 29 Agu 2026 (`57cccaf`) |
| `lantai-siswa` | Harga siswa tidak di bawah bottom price | wajib | Finance | `po.harga_siswa` ≥ `private.lantai_siswa(po.id)`, kecuali PO unggahan dengan pengecualian HoO yang tercatat | `lib/po-aksi.ts` `periksa()`; `supabase/migrasi/20260909_lantai_harga_di_basis_data.sql`; `20260909c_gerbang_pengecualian.sql` | 9 Sep 2026 (`1844d74`, `bbfaf44`) |
| `lantai-guru` | Harga guru tidak di bawah bottom price | wajib | Finance | `po.harga_guru` ≥ `private.lantai_guru(po.id)` bila `jumlah_guru` > 0, kecuali pengecualian HoO | idem | 9 Sep 2026 (`1844d74`) |
| `termin-sama-total` | Wajib ada minimal 1 termin, dan Σ nominal termin = grand total | wajib | Finance | ada ≥1 baris `po_termin`, dan Σ `po_termin.nominal` = `po.grand_total` | `lib/po-aksi.ts` `periksa()`; `lib/kelengkapan-po.ts` `kekuranganPo()` | 29 Agu 2026 (`a6f0f1e`) |
| `unggahan-ditinjau` | PO unggahan hanya boleh maju bila sudah ada pernyataan "sesuai pindaian" | wajib bila `asal = 'unggahan'` | Service Account | `po.ditinjau_pada` tidak null dan `po.berkas_unggahan` tidak null | `supabase/migrasi/20260909d_ajukan_po_unggahan.sql`, `20260910e_email_kosong_rpc_diperketat.sql` | 9 Sep 2026 (`1f1a6cc`, `b8db05f`) |
| `jumlah-siswa-minimal` | Jumlah siswa minimal 1 | wajib | Education | `po.jumlah_siswa` ≥ 1 | `lib/po-aksi.ts` `periksa()` | 29 Agu 2026 (`a6f0f1e`) |

**Catatan penting soal `lantai-siswa` dan `lantai-guru`.** Keduanya diperiksa
**tepat sekali**, pada transisi PO meninggalkan draf. Sesudah itu `bekukan_isi_po`
menjamin harganya mustahil berubah, jadi memeriksa ulang bukan cuma mubazir tapi
berbahaya: ia akan membekukan PO lama yang harganya di bawah lantai hari ini
sehingga tidak bisa dimajukan lagi. Ada satu PO seperti itu (PO-1, `pks_terbit`,
harga 158.000 sementara lantai 186.000) yang sengaja tidak diperiksa surut.

### Akar satu masalah: transisi keluar draf tidak punya gerbang

Ditemukan 16 Sep 2026 saat meninjau tabel di atas. `kirimUntukTtd()`
(`lib/po-aksi.ts:470`) **hanya mengubah status**, tanpa gerbang apa pun:

- tidak memanggil `periksa()` lagi,
- tidak memanggil `kekuranganPo()`,
- tombolnya di `app/(sistem)/po/[id]/panel-ttd.tsx:66` tidak digerbang apa pun,
- di basis data, transisi `draf` → `menunggu_ttd` tidak dijaga trigger.

Akibatnya semua syarat yang hidup di `periksa()` aman **kebetulan**, karena
`bekukan_isi_po` membekukan isinya sesudah keluar draf. Tapi syarat yang TIDAK ada
di `periksa()` (yaitu aturan termin nol dan tiga aturan di Bagian 2) tidak punya
penjaga sama sekali di transisi itu.

**Yang sudah dibuktikan berlubang:** `termin-sama-total`. Aturan yang berlaku
sekarang berbunyi `if (totalTermin > 0 && totalTermin !== grand)`
(`lib/po-aksi.ts:166-169`), jadi PO dengan **nol termin** lolos sepenuhnya. PO
bernilai Rp 12.650.000 tanpa satu pun termin bisa sampai ke tanda tangan dan
lanjut ke verifikasi. Yang ditolak cuma PO yang terminnya ada tapi jumlahnya salah.

**Keputusan Rizki 16 Sep 2026:** wajib ada minimal 1 termin, dan Σ termin =
grand total, ditegakkan **saat keluar draf**. Ini mengubah aturan yang sudah
berjalan, jadi ia masuk Fase 1 sebagai perubahan perilaku, bukan sekadar
pemindahan aturan lama ke tabel.

**Catatan soal jalur unggahan:** `ajukan_po_unggahan()` melompat `draf` →
`ditandatangani` langsung, melewati `menunggu_ttd`. Jadi lubang yang sama berlaku
di sana tanpa perantara; gerbangnya harus dipasang di RPC itu juga, bukan hanya di
`kirimUntukTtd()`.

**Penjaga yang lebih lemah dari kelihatannya.** `minimal-peserta`,
`kapasitas-sesi`, dan `komponen-dikenal` hidup di tabel anak (`po_komponen`) yang
tidak ikut dibekukan `bekukan_isi_po`. Mereka aman hari ini **hanya karena**
`simpanDraf` menolak menyimpan saat status bukan draf/ditolak (`lib/po-aksi.ts:262`).
Itu penjagaan di kode aplikasi, bukan di basis data, jadi PostgREST bisa
melewatinya. Bukan lubang baru, tapi jangan dianggap sudah tertutup rapat.

---

## Bagian 2. Aturan yang belum ditegakkan di jalur maju (usulan baru)

Tiga aturan ini **sudah ada di aplikasi, tapi hanya sebagai syarat cetak, bukan
syarat maju.** Artinya PO bisa melewati `draf` ke `menunggu_ttd` dengan masa aktif
yang belum lengkap atau tanggal berakhir sebelum tanggal mulai.

Di mana persisnya lubangnya, setelah saya lacak:

- `simpanDraf()` memang memanggil `periksa()`, tapi `periksa()` **tidak menyebut
  `masa_mulai`/`masa_selesai` sama sekali** (saya cek satu per satu; satu-satunya
  kecocokan kata "masa" di fungsi itu adalah `rk.hasil.masalah`, tidak ada
  hubungannya).
- `kirimUntukTtd()` hanya mengubah status, tanpa memanggil `periksa()` lagi.
- Di basis data, `jaga_lantai_po` juga hanya memeriksa lantai harga pada transisi
  keluar draf, dan tidak ada `check` constraint untuk urutan tanggal.

| Kode | Teks aturan | Wajib | Fungsi wilayah | Kondisi lolos | Status hari ini |
|---|---|---|---|---|---|
| `masa-aktif-lengkap` | Masa aktif PO harus lengkap: tanggal mulai dan tanggal selesai terisi | usulan: wajib | Service Account | `po.masa_mulai` dan `po.masa_selesai` keduanya tidak null | hanya di `lib/kelengkapan-po.ts` `kekuranganPo()` (gerbang CETAK) |
| `masa-aktif-wajar` | Tanggal selesai harus sesudah tanggal mulai | usulan: wajib | Service Account | `po.masa_selesai` > `po.masa_mulai` | idem, belum ada di `periksa()` dan belum ada check constraint di basis data |
| `sekolah-lengkap` | Data sekolah lengkap: NPSN, nama kepala sekolah, nomor HP kepala sekolah, nama bendahara, nomor HP bendahara | usulan: wajib untuk PO yang akan ditandatangani | Education, Tech Ops, Service Account | kelima isian tidak kosong | hanya di `kekuranganPo()` (gerbang CETAK) |

**Di mana aturan ini seharusnya dipasang: transisi keluar draf, bukan saat simpan.**
Ini penting dan gampang salah tempat. `lib/kelengkapan-po.ts` sengaja memisahkan
syarat simpan dari syarat cetak dengan alasan yang masih berlaku: *"Draf boleh
disimpan setengah jadi; itu gunanya draf."* Kalau ketiga aturan ini dipasang di
`simpanDraf()`, Sales kehilangan kemampuan menyimpan pekerjaan yang belum selesai,
dan itu kemunduran. Tempat yang benar adalah transisi `draf` → `menunggu_ttd`,
sejajar dengan `jaga_lantai_po` yang sudah memakai transisi itu. Kalau mau
ditegakkan dua lapis, `kirimUntukTtd()` memanggil `periksa()` lagi (pesan manusia)
dan trigger basis data menolak transisinya (penjagaan sesungguhnya).

**Keputusan Rizki 16 Sep 2026 (B):** ketiga aturan dinaikkan menjadi syarat maju,
**berlaku untuk PO baru saja, tidak surut.**

Arti "PO baru" yang dipilih: PO yang **dibuat** sesudah aturan ini hidup. PO yang
sudah ada sebelum itu, termasuk yang masih berstatus `draf`, tidak diperiksa
ketiga aturan ini. Caranya: stempel `versi_iom` pada PO saat dibuat; PO tanpa
stempel dianggap PO lama. Ini menambah satu kolom di tabel `po`, dan sejalan
dengan versioning yang sudah direncanakan di Fase 2.

**Ditegaskan saat penetapan 17 Sep 2026:** `sekolah-lengkap` tetap menuntut **kelima**
isian, termasuk nama dan nomor HP bendahara. Sebelum menyetujui, Rizki diberi tahu
bahwa PO kertas sungguhan sering mengosongkan baris bendahara (contoh: PO SMA Advent
Bogor yang sudah ditandatangani tidak mengisinya), sehingga PO seperti itu tidak bisa
maju sampai Sales melengkapi data bendahara dari sekolah. Rizki memilih aturan apa
adanya.

Konsekuensi yang disengaja: draf lama yang datanya belum lengkap tetap bisa maju
seperti hari ini. Kalau itu tidak diinginkan, keputusannya harus diubah sebelum
Fase 1, karena sesudah ada PO yang lewat, mengubahnya surut berarti membekukan PO
yang sedang berjalan.

Tempat pemasangan tetap seperti di atas: transisi `draf` → `menunggu_ttd` di
`kirimUntukTtd()` **dan** RPC `ajukan_po_unggahan()` (jalur unggahan melewati
`menunggu_ttd`). Gerbang sesungguhnya di basis data; `periksa()` mengembalikan
pesan manusia supaya Sales tahu apa yang kurang.

---

## Bagian 3. Deklarasi kesiapan produk/paket (pengganti 12 butir subjektif)

Ini inti Fase 0, dan bagian yang **tidak bisa saya isi sendiri**.

Masalahnya: dari 16 butir checklist, **14 wajib** (`b4` dan `d4` bertanda
`opsional`), dan **10 di antaranya penilaian manusia**, bukan perhitungan. Selama
butir-butir itu diwajibkan per PO, tidak ada PO yang akan pernah lolos otomatis.
Jalan keluarnya adalah memindahkan penilaian itu dari **per PO** menjadi **per
produk/versi paket**: dihitung sekali, lalu PO kelas standar cukup menunjuk
deklarasi itu.

### Keputusan Rizki 16 Sep 2026 (C)

**C1. Perhitungan: satu deklarasi per produk/paket.** Contoh: "Bimbel Online
(TKA/UTBK)" punya satu deklarasi, berlaku untuk semua PO yang memakai produk itu.
Bukan per jenjang, bukan per versi pricelist.

**C2. Penanda tangan: Rizki (Head of Product & Ops), sendirian.** Alasannya: satu
orang memegang produk sekaligus operasi, jadi dialah yang paling tahu kesiapan
sebuah produk.

> **Risiko yang perlu dicatat, bukan untuk dibantah sekarang.** Kalau satu orang
> menandatangani semua deklarasi, ia menjadi penghalang tunggal rilis produk:
> setiap produk baru atau produk yang berubah menunggu dia. Orang yang sama juga
> menutup antrean verifikasi manual untuk PO eskalasi. Jadi dua jalur berhenti
> sekaligus saat ia tidak ada. Tabelnya sudah menyediakan kolom penanda tangan,
> jadi pengalihan ke kepala fungsi bisa dilakukan tanpa migrasi baru. Keputusan
> ini dicatat apa adanya supaya tidak jadi kejutan enam bulan lagi.

**C3. Penyimpanan: tabel baru di basis data**, dengan masa berlaku dan penanda
tangan tercatat. Bukan dokumen di luar sistem.

### Bentuk tabel yang diusulkan

```
deklarasi_kesiapan
  produk        text      -- kunci, cocok dengan harga_paket.nama
  versi_produk  text      -- naik saat produk berubah
  butir         text[]    -- butir yang dideklarasikan: a1,a2,a3,b1,b2,b3,c2,d3,e3,e4
  berlaku_sampai date     -- masa berlaku; lewat ini, PO kembali manual
  ditandatangani_oleh text
  ditandatangani_pada timestamptz
  primary key (produk, versi_produk)
```

**Cara PO dicocokkan dengan deklarasi** (diputuskan 16 Sep 2026, mekanis jadi
tidak perlu ditanyakan): kunci deklarasi adalah **nama paket**, dan PO dicocokkan
lewat komponen intinya. Kalau susunan komponen inti PO **persis sama** dengan
sebuah `harga_paket.ids`, PO itu memakai deklarasi paket tersebut. Kalau tidak
persis (a la carte), tidak ada deklarasi yang cocok, dan PO masuk antrean manual.
Ini jatuh tepat di atas aturan Bagian 4 dan tidak butuh kolom baru.

**Masa berlaku (keputusan Rizki 17 Sep 2026): 6 bulan** sejak ditandatangani, kira-kira
satu semester. Lewat tanggal itu, PO untuk paket tersebut kembali ke antrean manual
sampai Rizki menandatangani ulang. Deklarasi tanpa kedaluwarsa ditolak karena akan
berhenti benar diam-diam begitu produknya berubah.

### Deklarasi pertama (ditandatangani Rizki, 17 Sep 2026)

Sebelum menjawab, Rizki diberi penjelasan arti kesepuluh butir dan konsekuensinya:
deklarasi berlaku untuk setiap sekolah yang membeli paket itu (termasuk `c2`, `e3`,
`e4` yang biasanya dinilai per sekolah), dan deklarasi yang keliru tidak akan
tertangkap siapa pun karena PO paket itu melewati keempat fungsi. Rizki menyatakan
ketujuh paket siap untuk kesepuluh butir.

| Produk (`harga_paket.nama`) | Komponen inti (`ids`) | `versi_produk` | Butir | `berlaku_sampai` |
|---|---|---|---|---|
| LMS Juara | lms, modul, video, soal, asesmen, tryout, live, snbp | 1 | a1, a2, a3, b1, b2, b3, c2, d3, e3, e4 | 2027-03-17 |
| LMS Smart | lms, modul, video, soal | 1 | idem | 2027-03-17 |
| LMS Lite | lms | 1 | idem | 2027-03-17 |
| Bimbel UTBK/TKA Premium | modul, video, soal, asesmen, tryout, live, snbp | 1 | idem | 2027-03-17 |
| Bimbel UTBK/TKA Lite | modul, video, soal, asesmen, tryout, snbp | 1 | idem | 2027-03-17 |
| Asesmen Psikologi | asesmen | 1 | idem | 2027-03-17 |
| Tryout | tryout | 1 | idem | 2027-03-17 |

`ditandatangani_oleh`: Rizki (email akunnya diisi saat baris ditulis ke basis data di
Fase 2), `ditandatangani_pada`: 17 Sep 2026.

**Sudah dicek 17 Sep 2026 (kueri baca di produksi):** ketujuh nama dan himpunan `ids` di
tabel ini persis sama dengan tabel `harga_paket` produksi. Pencocokan PO memakai kunci ini,
jadi bila `PRESET` atau `harga_paket` berubah, cek ulang sebelum baris deklarasi ditulis
di Fase 2.

**Yang tetap berlaku walau paket dideklarasikan:** `e1` (daftar layanan sesuai PO) tidak
punya aturan mesin, jadi tetap penilaian manusia; PO a la carte, sponsorship, pengecualian
HoO, deviasi harga, dan permintaan fitur tetap manual (Bagian 4).

---

## Bagian 4. Kelas PO yang boleh lolos otomatis

`catatan/13` Fase 0 butir 3 sudah mengusulkan: platform (bukan unggahan), atau
unggahan yang sudah `ditinjau` dan **tanpa** pengecualian HoO, **tanpa**
sponsorship/hibah, **tanpa** deviasi harga. Sisanya wajib manual.

| Sifat PO | Boleh otomatis? | Alasan |
|---|---|---|
| Platform, kelas standar, produk sudah punya deklarasi kesiapan | usulan: ya | semua aturan di Bagian 1 bisa diperiksa mesin |
| Platform, ada komponen di luar paket standar | usulan: tidak | susunan a la carte perlu penilaian harga dan kelayakan |
| Unggahan, sudah ditinjau, tanpa pengecualian HoO | usulan: ya | sama, asal `unggahan-ditinjau` lolos |
| Unggahan dengan pengecualian HoO | usulan: tidak | ada persetujuan manusia di dalamnya, tidak boleh dilewati mesin |
| Ada sponsorship atau hibah (`po_catatan` jenis `sponsorship`) | ~~usulan: tidak~~ **ya bila nilainya paling banyak 15% dari grand total** (Bagian 8) | `d4` dipindah ke tahap PKS: Finance mengonfirmasi dokumen sebelum PKS basah diunggah |
| Ada deviasi harga | usulan: tidak | `d1` menyebut "atau deviasi sudah disetujui", dan persetujuan itu dokumen, bukan angka |
| Ada permintaan penambahan produk (`b4`) | usulan: tidak | permintaan fitur selalu perlu komitmen Tech Ops |

**Satu detail yang perlu kamu putuskan:** butir `b4` dan `d4` di
`lib/checklist.ts` bertanda `opsional`. **Diputuskan Rizki 16 Sep 2026: ya, keduanya
memang opsional.** Jadi butir wajib ada **14**, dan butir subjektif yang wajib ada
**10**, bukan 12. Angka di `catatan/13` perlu dikoreksi bila begitu.

**Keputusan Rizki 16 Sep 2026 (D1):** tabel kelas PO di bawah disetujui apa adanya,
**termasuk baris deviasi harga**, dengan catatan bahwa baris itu baru bisa berjalan
setelah aturan `harga-sesuai-pricelist` dan tabel persetujuan deviasi dibuat. Sampai
itu, baris itu tertulis tapi tidak menyala.

### Catatan penting: `d1` belum benar-benar bisa diperiksa mesin

`catatan/13` menyebut `d1` (harga sesuai pricelist) sebagai salah satu dari empat
butir yang bisa dipastikan mesin. Setelah saya lacak, **itu belum benar hari ini**,
dan ini perlu dikoreksi sebelum Fase 1 dimulai.

Yang ditegakkan sekarang hanya **lantai** (`bottom price`): `lib/po-aksi.ts:156`
memakai `h.perSiswa[1]`, yaitu tier kedua dari `hitung()`. Tier pertama
(`perSiswa[0]`, harga `price_list`) dipakai sebagai **nilai awal** di
`app/(sistem)/po/baru/use-form-po.ts` dan `langkah/paket.tsx`, tapi tidak ada satu
pun tempat yang membandingkan `po.harga_siswa` terhadapnya. Jadi:

- Harga **di bawah** lantai: ditolak.
- Harga **di antara** lantai dan price_list: **lolos tanpa ada yang tahu** itu
  sebuah deviasi.

Artinya `d1` hari ini hanya memeriksa separuh: "tidak di bawah lantai", bukan
"sesuai pricelist". Kalau `d1` mau tetap diklaim mesin, aturannya harus ditulis
jujur sebagai `harga-tidak-di-bawah-lantai`, dan deviasi di atas lantai tetap
masuk penilaian manusia. Alternatifnya, tambahkan aturan baru
`harga-sesuai-pricelist` yang membandingkan `harga_siswa` dengan `perSiswa[0]`
dan mengizinkan selisih **hanya bila ada persetujuan deviasi tercatat**. Yang
kedua lebih kuat, tapi butuh tabel persetujuan deviasi yang belum ada, jadi ia
menambah pekerjaan di luar Fase 1.

---

## Bagian 5. Yang tetap manual selamanya

Bagian ini tidak berubah dari `catatan/13`; saya tulis ulang di sini supaya satu
dokumen ini bisa berdiri sendiri saat ditandatangani.

| Kode | Butir | Kenapa tidak bisa mesin |
|---|---|---|
| `a1` | Kurikulum dan learning objective jelas | penilaian akademik |
| `a2` | Materi sesuai level target siswa | penilaian akademik |
| `a3` | Konten telah melalui QC dan approval | bukti QC ada di luar sistem |
| `b1` | Fitur utama berfungsi tanpa bug kritikal | penilaian severity |
| `b2` | Severity bug ditentukan tepat dan konsisten | penilaian severity |
| `b3` | Integrasi sistem berjalan normal | penilaian teknis |
| `b4` | Permintaan penambahan produk siap dilaksanakan | komitmen Tech Ops (opsional) |
| `d3` | Status pajak jelas: harga sudah termasuk pajak | dokumen pajak |
| `d4` | Sponsorship atau hibah punya dokumen pendukung | dokumen (opsional) |
| `c2` | Tim support siap: jadwal dan tools | penilaian operasional |
| `e3` | PIC layanan sudah ditetapkan | penugasan orang |
| `e4` | Checklist bulanan siap dibuat | penilaian operasional |

Yang **bisa** mesin hari ini, dipetakan ke butir checklist-nya:

| Butir checklist | Aturan di Bagian 1 | Benar-benar diperiksa mesin? |
|---|---|---|
| `d2` termin total = nilai PO | `termin-sama-total` | ya, `periksa()` |
| `e2` min peserta & kapasitas | `minimal-peserta`, `kapasitas-sesi` | ya, `periksa()` |
| `d1` harga sesuai pricelist | `lantai-siswa`, `lantai-guru` | **separuh**: hanya lantai, lihat catatan di Bagian 4 |
| `e1` daftar layanan sesuai PO | tidak ada aturan yang setara | **tidak**. Tidak ada kode yang membandingkan layanan yang tercatat di PO dengan apa pun. Ini penilaian manusia sampai ada aturannya. |
| sisanya (10 butir wajib) | tidak ada | tidak, penilaian manusia |

Jadi jumlah yang benar-benar bisa mesin hari ini adalah **tiga butir** (`d2`, `e2`,
dan separuh `d1`), bukan empat seperti tertulis di `catatan/13`. Selisihnya bukan
hal sepele: ia menentukan berapa banyak PO yang benar-benar bisa lewat gerbang
otomatis, dan menjanjikan lebih banyak daripada yang bisa ditepati akan membuat
inisiatif ini dinilai gagal padahal aturannya cuma kurang lengkap.

Empat aturan struktural lain di Bagian 1 (`sekolah-terisi`, `komponen-dikenal`,
`jumlah-siswa-minimal`, `unggahan-ditinjau`) memang diperiksa mesin, tapi mereka
tidak memetakan ke butir checklist mana pun; mereka syarat kelengkapan, bukan
butir verifikasi.

---

## Bagian 6. Keputusan Fase 0

Kelima keputusan diambil Rizki pada **16 Sep 2026**. Fase 1 (`lib/iom.ts`) boleh
dimulai setelah dokumen ini ditandatangani.

- [x] **A. Bagian 1** diperiksa dan disetujui apa adanya, atau ada yang dikoreksi?
      **SELESAI 16 Sep 2026.** Sembilan aturan disetujui apa adanya, dengan satu
      koreksi pada `termin-sama-total` (wajib ≥1 termin, Σ = grand total,
      ditegakkan saat keluar draf). Angka di `minimal-peserta` dan
      `kapasitas-sesi` disetujui; mengubahnya berarti naik versi IoM.
- [x] **B. Bagian 2**: **SELESAI 16 Sep 2026.** Ketiganya jadi syarat maju,
      berlaku untuk PO baru saja (stempel `versi_iom` saat dibuat; PO tanpa
      stempel tidak diperiksa). Dipasang di `kirimUntukTtd()` **dan**
      `ajukan_po_unggahan()`.
- [x] **C. Bagian 3**: **SELESAI 16 Sep 2026.** Satu deklarasi per produk/paket;
      penanda tangan Rizki sendiri (risiko penghalang tunggal dicatat); disimpan
      di tabel `deklarasi_kesiapan` dengan masa berlaku. Pencocokan PO memakai
      komponen inti vs `harga_paket.ids`.
- [x] **D. Bagian 4**: **SELESAI 16 Sep 2026.** Kelas PO disetujui apa adanya,
      termasuk baris deviasi harga (butuh aturan `harga-sesuai-pricelist` +
      tabel persetujuan deviasi sebelum menyala). `b4` dan `d4` dikonfirmasi
      opsional: butir wajib 14, subjektif wajib 10.
- [x] **E. Bagian 5**: **SELESAI 16 Sep 2026.** Head of Operations (Rizki)
      tercetak dan menandatangani Surat Verifikasi Kesiapan untuk PO yang lolos
      otomatis, sesuai rekomendasi `catatan/13`.

### Konsekuensi yang harus dibawa ke fase berikutnya

**E bertabrakan dengan penetapan sebelumnya di `catatan/13`.** Dokumen itu
menetapkan HoO menutup **hanya** untuk PO eskalasi manual, dan `tech_ops_lead`
untuk jalur rutin. Keputusan E menambah peran kedua untuk HoO: ia juga
menandatangani surat untuk **PO otomatis**. Jadi HoO memegang dua jalur, dan
`catatan/13` Fase 3 perlu diamandemen pada bagian itu.

**Penjagaan tanda tangan surat harus diperluas.** `simpanTtdSurat()` dan
`finalisasiSurat()` (`lib/surat-aksi.ts`) sama-sama memakai `leadSaatIni()`, yang
hanya menerima `tech_ops_lead`. Agar HoO bisa menandatangani PO otomatis,
penjagaannya diperluas **khusus untuk PO yang lolos otomatis**, bukan untuk semua
PO. `tech_ops_lead` tetap untuk jalur rutin.

**Tanda tangan tetap gambar, dan tetap manusia.** `finalisasiSurat()` menolak bila
`berkas` kosong: *"Tanda tangan Tech Ops Lead belum dibubuhkan."* PO yang lolos
otomatis tetap berhenti di langkah ini menunggu HoO membubuhkan tanda tangannya.
Verifikasi otomatis tidak menghilangkan langkah itu, dan memang tidak bisa.

**`diverifikasi_oleh` harus diisi email HoO, bukan `sistem:iom-...`.** Rantai nama
di `app/(sistem)/po/[id]/surat/page.tsx:54-58` adalah:

```
namaLead = surat?.nama_penanda || penutup?.nama || po.diverifikasi_oleh || '-'
```

`penutup` dicari lewat `daftarPengguna()` berdasarkan email, jadi string
`sistem:iom-...` tidak akan pernah ketemu dan surat tercetak dengan nama `'-'`.
Solusinya: `diverifikasi_oleh` tetap nama orang (email HoO), sedangkan cap
"diverifikasi otomatis IoM vX" disimpan di kolom terpisah (`versi_iom`). Ini juga
sejalan dengan keputusan Fase 2 yang sudah merencanakan kolom `versi_iom`.

**Tiga aturan di Bagian 2 mengubah perilaku yang sudah berjalan** (`masa-aktif-lengkap`,
`masa-aktif-wajar`, `sekolah-lengkap`), ditambah koreksi `termin-sama-total`.
Keempatnya bukan sekadar pemindahan aturan lama ke tabel, melainkan pengetatan
baru. Karena itu ia masuk Fase 1 sebagai perubahan perilaku dan harus punya uji
yang membuktikan kedua sisi: PO lengkap boleh maju, PO tidak lengkap ditolak.

### Prasyarat di luar kode yang masih menahan

- Tinjauan legal atas kalimat pemberitahuan UU PDP (`catatan/10`,
  `catatan/05`). Butir ini menahan seluruh sub-proyek, bukan hanya yang ini.
- ~~Nilai `pricelist_aktif.versi` di produksi masih `'belum diisi'`~~ **Tuntas:**
  dicek 17 Sep 2026, produksi sudah berisi `af4fc50e4ac9` (diperbarui 9 Sep 2026),
  sama dengan `VERSI_PRICELIST` di `lib/pricelist.ts`. Nilai `'belum diisi'` hanya
  nilai awal di migrasi. IoM memakainya sebagai kunci konsistensi verdict.
- Kondisi produksi saat Fase 0 ditutup (17 Sep 2026): 2 PO (1 `verifikasi`,
  1 `pks_terbit`); tidak ada PO non-draf tanpa termin atau dengan masa aktif tidak
  wajar, jadi lubang di Bagian 1 dan 2 belum pernah terpakai.

## Bagian 7. Amandemen `iom-2026-09-17b` (17 Sep 2026)

Ditemukan saat menyusun rencana Fase 1 (`catatan/14`): empat celah yang membuat aturan
tidak bisa dijalankan dengan jujur. Rizki memutuskan keempatnya pada hari yang sama,
sebelum satu pun PO dicap, jadi belum ada PO atau verdict yang memakai versi lama.

1. **`e1` punya aturan mesin: `layanan-sesuai-paket`.** Tanpa aturan, `e1` tetap
   penilaian manusia dan tidak ada PO yang bisa lolos otomatis. Kini `e1` dianggap
   terpenuhi bila susunan komponen PO persis sama dengan paket yang dideklarasikan,
   pencocokan yang memang sudah dituntut jalur otomatis.
2. **Permintaan penambahan produk (`b4`) dicatat lewat kotak centang di wizard**
   (langkah Penanda tangan & catatan), disimpan di kolom `po.permintaan_tambahan` dan
   dibekukan bersama isi PO. Dicentang berarti manual.
3. **Diskon apa pun berarti manual** sampai tabel persetujuan deviasi ada. Menggantikan
   keputusan D1 yang membiarkan baris deviasi tidak menyala: aturan `tanpa-diskon`
   menuntut harga siswa tidak di bawah price list paket.
4. **PO berkelompok selalu manual** (aturan `satu-kelompok`).

**Tiga pembacaan harfiah yang ikut dicatat** (keputusan sebelumnya, ditulis tegas supaya
tidak ditafsir ulang diam-diam):

- **Keputusan A (termin) berlaku untuk SEMUA PO**, berstempel atau tidak, karena A tidak
  dibatasi PO baru. Keputusan B (masa aktif, data sekolah) tetap hanya PO berstempel.
  Saat penetapan tidak ada PO berstatus draf, jadi tidak ada PO yang tertahan karenanya.
- **PO tanpa stempel `versi_iom` (PO lama) selalu manual**, karena syarat B tidak pernah
  diperiksa untuknya (aturan `po-berstempel-iom`).
- **"Komponen di luar paket standar" termasuk add-on dan Pelatihan Guru** (Bagian 4):
  susunan komponen PO harus sama persis dengan `harga_paket.ids`; ada komponen lain apa
  pun berarti manual.

## Bagian 8. Amandemen `iom-2026-09-17c`: nilai sponsorship (17 Sep 2026)

Spesifikasi lengkapnya `catatan/18-spesifikasi-nilai-sponsorship.md`. Keputusan Rizki:

1. **Sponsorship mengambil 15% dari pendapatan**, dan dasarnya **grand total PO** (harga yang
   disepakati, termasuk add-on dan Pelatihan Guru).
2. **Bottom Price tidak ikut diperiksa:** porsi 15% sudah ada dalam penetapan harga, jadi PO
   seharga Bottom Price tetap boleh bersponsorship 15%.
3. **Nilai dicatat sebagai satu angka Rupiah** di kolom baru `po.nilai_sponsorship`; barang dan
   media dinilai dengan harga pokoknya bagi Skolla.
4. **Aturan `tanpa-sponsorship` diganti `sponsorship-dalam-batas`:** lolos bila tanpa
   sponsorship atau `nilai * 100 <= grand_total * 15`; gagal bila di atas batas atau catatan dan
   nilai tidak berpasangan. Di atas batas berarti manual, bukan diblokir.
5. **Butir `d4` (dokumen pendukung) diperiksa di tahap PKS** untuk setiap PO bersponsorship:
   Finance mengonfirmasi dokumen, rekening atas nama lembaga, dan meterai hibah di atas
   Rp5.000.000, dan basis data menolak unggahan PKS basah sebelum konfirmasi itu ada.

Tabel batas per siswa untuk setiap paket, komponen, dan add-on ada di `catatan/18`.

## Bagian 9. Amandemen `iom-2026-09-22`: PO berkelompok otomatis (22 Sep 2026)

**Keputusan Rizki 22 Sep 2026.** Menggantikan Bagian 7 butir 4 ("PO berkelompok selalu
manual").

Alasannya: harga per siswa PO berkelompok tersimpan di `po_kelompok`, dan tabel itu memang
cara resmi memberi harga BERBEDA per kelompok. Melarangnya otomatis berarti setiap PO
berkelompok menyita waktu keempat fungsi, padahal isinya bisa diperiksa mesin sepenuhnya.

1. **Aturan `satu-kelompok` diganti `kelompok-terdefinisi`.** Yang dinilai bukan lagi
   "PO ini berkelompok atau tidak", melainkan "jumlah baris kelompoknya utuh dan terbaca".
   PO berkelompok yang barisnya gagal terbaca tetap ditolak, bukan dinilai kosong lalu lolos.
2. **Tiap kelompok dinilai sendiri.** Komponen tiap kelompok harus persis sama dengan satu
   `harga_paket.ids` (`paket-persis`, `layanan-sesuai-paket`), dan deklarasi kesiapan paket
   itu harus berlaku (`deklarasi-berlaku`). Paketnya boleh BERBEDA antar kelompok —
   LMS Juara di satu kelompok dan LMS Smart di kelompok lain adalah keadaan yang sah.
3. **Harga dinilai per kelompok, dari `po_kelompok.harga_siswa`.** `lantai-siswa` menuntut
   tiap kelompok tidak di bawah bottom price paketnya. Sebelumnya PO berkelompok dilewati
   aturan ini karena `po.harga_siswa` bernilai 0, dan penilaian nol itu melahirkan
   kegagalan palsu (temuan PO-344, 21 Sep 2026).
4. **Diskon per kelompok DIIZINKAN sebatas bottom price.** Aturan `tanpa-diskon`
   (Bagian 7 butir 3) TIDAK berlaku untuk PO berkelompok: kelompok di bawah price list
   tapi masih >= bottom tetap lolos. PO satu kelompok tidak berubah, tetap wajib tanpa
   diskon. Ini keputusan komersial sadar: harga bertingkat per kelompok memang alat yang
   diberikan kepada Sales, dan lantai bottom price tetap utuh sebagai batas.
5. **Penutupan memeriksa deklarasi SETIAP paket** yang dipakai, bukan satu. `paket` di
   baris verdict berisi nama tunggal bila hanya satu paket dipakai (termasuk PO satu
   kelompok), dan `kelompok` berisi seluruh nama paket. Layar menyebut seluruhnya.

## Bagian 10. Amandemen `iom-2026-09-22b`: pembuat PO boleh menutup (22 Sep 2026)

**Keputusan Rizki 22 Sep 2026.** Melepas satu bagian pemisahan tugas pada jalur penutupan
verifikasi otomatis.

Aturan lama — "pembuat PO tidak boleh menutup verifikasinya sendiri" — adalah pemisahan
tugas yang sehat, tapi di Skolla ia tidak memisahkan siapa pun dari siapa: hanya ada SATU
Head of Operations aktif (Rizki). Akibatnya PO buatannya sendiri yang lolos otomatis tidak
punya penutup sama sekali dan jatuh ke keempat fungsi, padahal isinya sudah lolos mesin.
Aturan itu cuma menambah satu jalan memutar tanpa menambah pemeriksa.

1. **Pembuat PO boleh menutup PO-nya sendiri, asalkan ia Head of Operations.** Yang menentukan
   tinggal peran HoO harfiah (`peran_saya()`), bukan siapa pembuatnya.
2. **Yang TIDAK berubah:** penutupan tetap hanya HoO, tanpa satu pun penolakan, dengan verdict
   lolos untuk versi PO ini, dan deklarasi tiap paketnya masih berlaku. Penjagaan itu tetap
   ditegakkan trigger penutupan dan RPC, dan tetap diuji.
3. **Pemisahan tugas pada jalur verifikasi manual (empat fungsi) tidak berubah.**
4. **Konsekuensi yang diterima:** pada jalur otomatis, orang yang membuat PO kini boleh
   mengesahkannya sendiri. Ini sadar dan terbatas — hanya PO yang sudah lolos seluruh aturan
   mesin, dan hanya oleh pemegang peran HoO.

**Risiko yang dicatat, bukan untuk dibantah sekarang:** aturan ini masuk akal selama hanya
ada satu HoO. Begitu ada HoO kedua, pemisahan tugas jadi mungkin lagi — pertimbangkan
mengembalikannya (atau mengembalikannya hanya untuk PO bernilai besar) saat itu terjadi.

## Bagian 11. Amandemen `iom-2026-09-22c`: lolos IoM langsung bisa jadi PKS (22 Sep 2026)

**Keputusan Rizki 22 Sep 2026.** Menggantikan penutupan satu-klik Head of Operations
(Bagian 6 huruf E, dilanjutkan Bagian 10).

Alasannya: PO yang sudah lolos seluruh aturan mesin tidak perlu menunggu satu orang menekan
tombol. Yang diambil alih mesin hanya **langkahnya**, bukan penilaiannya.

1. **PO yang lolos naik sendiri ke `terverifikasi`.** Verdict yang lolos menutup PO-nya di
   dalam transaksi yang sama; tidak ada klik penutupan.
   **`diverifikasi_oleh` dikosongkan**, bukan diisi penanda "sistem". Alasannya teknis dan
   mengikat: kolom itu ber-FOREIGN KEY ke `pengguna(email)` (`20260829072645`), jadi nilai apa
   pun yang bukan email ditolak basis data — dan penolakan itu terjadi di dalam transaksi
   pengajuan verifikasi Sales, sehingga seluruh pengajuan ikut batal. Penanda otomatisnya
   hidup di `po.diverifikasi_otomatis`, dan versi aturannya di
   `verifikasi_otomatis.versi_iom`. Bagian 6 di atas, yang menuntut kolom ini berisi email
   HoO, berlaku untuk jalur lama ketika memang ada orang yang menutup; untuk jalur otomatis
   ia tidak lagi berlaku.
2. **Surat Verifikasi Kesiapan terbit dan terkunci otomatis**, tanpa tanda tangan gambar.
   Isinya: **sistem** yang mengkonfirmasi menurut ketentuan IoM yang berlaku saat itu, dan
   **Head of Operations serta Tech Ops Lead diinformasikan** — bukan menandatangani. Surat itu
   sengaja tidak memuat kalimat "dari sisi ...", karena tidak ada fungsi yang memutuskan;
   mencetaknya dengan daftar kosong menghasilkan "dari sisi  untuk", dan itulah cacat yang
   dulu membuat surat otomatis ditahan sepenuhnya.
3. **Gerbang PKS tidak disentuh.** `buat_pks` tetap menuntut status `terverifikasi` + surat
   final; bedanya surat itu kini sudah final begitu PO masuk, jadi tidak ada pengecualian baru
   di gerbangnya.
4. **Head of Operations dan Tech Ops Lead mengetahui lewat layar** (`/verifikasi`, bagian
   "Terverifikasi otomatis IoM"). Pemberitahuan lewat surel belum ada, dan itu pekerjaan
   terpisah.
5. **Yang dihapus, dan itu disengaja:** jalan penutupan HoO (`tutup_verifikasi_otomatis`)
   berikut tombolnya, dan syarat "ada HoO aktif". Konsekuensinya PO buatan satu-satunya HoO
   tidak bisa menggantung lagi (temuan QA 3a putaran 2), dan peran itu berhenti jadi penghalang
   tunggal bagi PO yang sudah lolos mesin.

**`VERSI_IOM` TIDAK naik.** Cara PO dinilai tidak berubah satu pun — yang berubah hanya siapa
atau apa yang menutup. Presedennya Bagian 10, yang juga tidak menaikkan versi. Aturan
`kelompok-terdefinisi`, deklarasi kesiapan, diskon, dan sponsorship tetap seperti Bagian 7
sampai 9.

**Sifat yang dipilih: gagal keras.** Bila penutupan otomatis melempar galat, transaksi
pengajuan verifikasi Sales ikut batal dan ia melihat pesannya; PO tetap `ditandatangani`.
Tidak ada keadaan "lolos tapi menggantung" yang tak bisa ditutup siapa pun.

**Yang dikorbankan, dan disadari:** tidak ada lagi mata manusia di jalur otomatis. Verdict
mesin menjadi satu-satunya otoritas atas dokumen yang berujung kontrak. Penangkal yang
tersisa: verdict fail-closed, deklarasi kesiapan yang kedaluwarsa 17 Mar 2027, dan aturan
`tanpa-diskon` / `sponsorship-dalam-batas` / `tanpa-permintaan-tambahan` yang melempar PO
menyimpang ke antrean empat fungsi.

**Kalimat Surat versi baru belum ditinjau legal.** Ini justru butir yang menahan Fase 3b
(`catatan/05`). Sekarang ia terbit dalam bentuk baru, jadi tinjauan legalnya **berpindah,
bukan hilang** — dan karena surat ini ikut ke sekolah, itu yang paling perlu dipastikan
sebelum dipakai untuk PO sungguhan.

**Yang belum diberesi, dan disadari.** Baris `po_riwayat` untuk perpindahan status ini tetap
tercatat atas nama **Sales yang mengajukan**, karena penutupannya berjalan di dalam transaksi
orang itu dan trigger `po_catat` mengambil nama dari `auth.jwt()`. Lini masa dan kartu riwayat
sekolah sudah menampilkannya sebagai perbuatan sistem (`lib/lini-masa.ts` menyembunyikan nama
penghubungnya bila `diverifikasi_otomatis`), tetapi barisnya sendiri belum bisa menyebut
sistem — jadi jejak auditnya masih menunjuk orang yang tidak memutuskan apa pun. Memperbaiki
sungguhan butuh trigger riwayat yang mengenal penanda `app.penutup_iom`; belum dikerjakan.

## Versi

- `versi_iom` BERLAKU SEKARANG: **`iom-2026-09-22`**, amandemen Bagian 9, diterapkan
  22 Sep 2026 lewat `supabase/migrasi/20260922_kelompok_otomatis.sql`
  (`private.versi_iom_berlaku()` mengembalikan nilai itu). Aturan `satu-kelompok` di
  Bagian 7 sudah TIDAK dinilai lagi; penggantinya `kelompok-terdefinisi`. Amandemen
  Bagian 10 (`20260922b_hoo_penutup_pembuat.sql`) TIDAK menaikkan versi: ia mengubah siapa
  yang boleh menutup, bukan cara PO dinilai. Amandemen Bagian 11
  (`20260922c_lolos_langsung_pks.sql`) juga TIDAK menaikkan versi, dengan alasan yang sama:
  penutupannya kini dikerjakan mesin, dan itu mengubah langkahnya, bukan penilaiannya.

- `versi_iom` sebelumnya: **`iom-2026-09-17c`**, amandemen Bagian 8, diterapkan
  20 Sep 2026 lewat `supabase/migrasi/20260920b_aturan_sponsorship_dalam_batas.sql`.
  Aturan `tanpa-sponsorship` di Bagian 7 sudah TIDAK dinilai lagi; penggantinya
  `sponsorship-dalam-batas`.

- `versi_iom`: **`iom-2026-09-17b`**, amandemen Bagian 7 atas `iom-2026-09-17`
  (ditetapkan Rizki 17 Sep 2026, tanggal persetujuan, bukan tanggal penyusunan 16 Sep).
  Cap ini akan tertulis di setiap verdict otomatis dan pada stempel PO baru (keputusan B).
- Dokumen ini menjadi lampiran `catatan/13`; perubahan aturan sesudahnya naik
  versi, tidak menyunting yang ini diam-diam.

## Rujukan berkas

Seluruh klaim di dokumen ini bisa dicek di repo ini:

- `lib/po-aksi.ts` (`periksa()`: syarat simpan dan maju)
- `lib/kelengkapan-po.ts` (`kekuranganPo()`: syarat cetak)
- `lib/aturan-komponen.ts` (`MIN_PESERTA`, `KAPASITAS_SESI`)
- `lib/checklist.ts` (16 butir, 4 fungsi, `WILAYAH`, `fungsiTerdampak`)
- `lib/po-aksi.ts:613` (`tutupVerifikasi`), `lib/supabase-server.ts:138` (`adalahLead`)
- `lib/pks-aksi.ts` (`buatPks`, `finalisasiPks`, `batalkanPks`)
- `supabase/migrasi/20260909_lantai_harga_di_basis_data.sql` (lantai di basis data)
- `supabase/migrasi/20260909c_gerbang_pengecualian.sql` (pengecualian HoO)
- `supabase/migrasi/20260909d_ajukan_po_unggahan.sql` (pernyataan sesuai pindaian)
- `supabase/migrasi/20260830_tutup_lubang_diagnostik.sql` (`po_jaga_penutupan`)
- `supabase/migrasi/20260909b_po_unggahan_skema.sql` (`bekukan_isi_po`)
- `catatan/04-peran-dan-keamanan.md`, `catatan/13-rencana-verifikasi-otomatis.md`
