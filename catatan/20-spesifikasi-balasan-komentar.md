# Spesifikasi: Balasan pada lini masa PO

Status: **DIBANGUN 21 Sep 2026**, disetujui Rizki. (Sebelumnya DIRANCANG 21 Sep 2026.)
Implementasi di cabang `build/balasan-komentar`, enam tugas, tiap tugas lolos review. QA independen dijalankan sebelum merge.
Memperluas `catatan/09` (komentar PO) dan mengubah bentuk `lib/lini-masa.ts`.

## Masalah

Komentar hari ini satu utas datar. Percakapan tentang satu peristiwa tercerai-berai:
"Finance menolak" berdiri di satu tempat, tanggapan Sales muncul entah di mana di antara
peristiwa lain, dan pembaca berikutnya harus menebak kalimat mana menjawab kalimat mana.
Semakin panjang lini masanya, semakin mahal tebakan itu — padahal lini masa justru dibaca
oleh orang yang datang belakangan dan bertanya "kenapa PO ini begini".

Yang dibutuhkan: balasan yang MENEMPEL pada peristiwa yang sedang dibicarakan.

Ini memperluas `catatan/09`, bukan membatalkannya. Keputusan #1 di sana — **satu utas
terbuka** — soal tidak adanya saluran tersembunyi dari Sales, bukan soal datar atau
berjenjang. Balasan yang visibilitasnya sama persis dengan komentar biasa tidak
melanggarnya. Yang harus diubah justru kalimatnya di layar, yang sekarang berbunyi
"Utas ini satu dan terbuka" dan terbaca seolah menjanjikan kedataran.

## Keputusan (Rizki, 21 Sep 2026)

| Hal | Keputusan |
|---|---|
| Apa yang bisa dibalas | **Semua peristiwa lini masa**, bukan hanya komentar. Termasuk keputusan verifikasi, tanda tangan, perpindahan status, penerbitan surat, dan tahapan PKS |
| Kedalaman | **Tanpa batas di data.** Indent di layar berhenti di tingkat 4, lebih dalam dari itu ditampilkan rata |
| Visibilitas | **Sama persis dengan komentar.** Mengikuti `private.boleh_lihat_po()`, tanpa aturan kedua |
| C Level | **Tetap tidak bisa menulis.** Balasan adalah komentar; penjagaan yang sudah ada berlaku apa adanya |
| Urutan balasan | **Terlama di atas**, kebalikan dari lini masanya sendiri |
| Peristiwa yang dibalas hilang | **Balasannya tetap tampil**, dengan nisan yang menerangkan |
| Sunting, hapus, revisi, `versi_po` | **Tidak ada aturan baru.** Balasan adalah baris `po_komentar` biasa |

## Kenapa kunci sintetis, bukan foreign key

Lini masa merangkai **enam sumber** (`lib/lini-masa.ts`). Tidak satu pun bisa ditunjuk
foreign key dengan jujur:

- `surat_verifikasi` dan `pks` menghasilkan **beberapa peristiwa dari satu baris** —
  satu baris `pks` memunculkan "Draf PKS disusun", "PKS difinalisasi", dan "Pindaian PKS
  bermeterai diunggah". Id barisnya tidak cukup menunjuk peristiwa mana.
- `tanda_tangan` **tidak punya kunci pengganti**: ia di-upsert pada `(po_id, pihak)`
  (`lib/po-aksi.ts`), dan yang lebih penting — ia **BENAR-BENAR DIHAPUS** saat PO
  dikembalikan untuk ditandatangani ulang (`po-aksi.ts:509`, dan aturan urutan status di
  `20260917d_urutan_status_po.sql`). Foreign key ke sana berarti balasan ikut terhapus
  cascade, atau insert-nya gagal.
- DDL `tanda_tangan`, `verifikasi`, `surat_verifikasi`, dan `pks` **tidak ada di repo
  ini** — tabel-tabel itu lahir sebelum folder `supabase/migrasi/` dimulai. Merancang
  foreign key ke skema yang tidak bisa dibaca adalah menebak.

Karena itu penambatnya **kunci peristiwa sintetis**: satu string yang dihitung
`lib/lini-masa.ts` dari data yang SUDAH diterimanya.

### Bentuk kunci

| Sumber | Kunci |
|---|---|
| Komentar | `komentar:<uuid>` |
| Perpindahan status | `riwayat:<po_riwayat.id>` — lihat catatan di bawah |
| Tanda tangan | `ttd:<pihak>:<waktu ISO>` |
| Keputusan verifikasi | `verifikasi:<fungsi>:<waktu ISO>` |
| Surat | `surat:dibuat:<waktu ISO>` · `surat:final:<waktu ISO>` |
| PKS | `pks:dibuat:<waktu ISO>` · `pks:final:<waktu ISO>` · `pks:unggah:<waktu ISO>` |

**Kaidahnya satu: setiap kunci selain komentar diakhiri waktu peristiwanya sendiri.**
Itu bukan hiasan. Tanda tangan yang dihapus lalu dibubuhkan lagi oleh pihak yang sama
akan memakai kunci BERBEDA, jadi balasan lama tidak pernah menempel diam-diam ke tanda
tangan baru. Tanpa waktu di dalam kunci, `ttd:kepala_sekolah` akan dipakai ulang dan
percakapan tentang tanda tangan yang sudah dibatalkan muncul di bawah tanda tangan
penggantinya, seolah membicarakannya.

Komentar tidak butuh waktu: uuid-nya sudah unik dan permanen — komentar dihapus dengan
ditandai, tidak pernah dibuang.

⚠️ **`SumberLiniMasa.riwayat` belum membawa `id`.** Tipenya hari ini hanya
`{ status_lama, status_baru, versi, oleh, pada }`, padahal halaman sudah memilih
`po_riwayat(*)` — jadi datanya tiba, tipenya saja yang belum menyebutnya. Tugas 3 wajib
menambahkan `id` ke tipe itu. Alternatifnya (`riwayat:<pada ISO>`) ditolak: dua
perpindahan status pada instan yang sama tidak mustahil, dan kunci yang bertabrakan
menempelkan percakapan ke peristiwa yang salah.

Kunci dihitung di SATU fungsi, `kunciPeristiwa()` di `lib/lini-masa.ts`, dan itulah
satu-satunya hal yang wajib stabil sepanjang umur sistem. Mengubah bentuknya memutuskan
balasan yang sudah ada dari induknya — semuanya sekaligus.

### Harga yang dibayar, sadar

Tidak ada integritas rujukan. Basis data tidak tahu `induk_kunci` menunjuk apa, dan tidak
bisa mencegahnya menunjuk peristiwa yang tidak ada.

Konsekuensi yang paling mungkin terjadi: **tanda tangan dihapus saat PO dikembalikan**,
dan balasan yang menempel padanya jadi yatim. Yang dilakukan bukan menyembunyikannya:

> Peristiwa yang dibalas sudah tidak ada di lini masa — mungkin tanda tangan yang
> dibatalkan saat PO dikembalikan.

Balasannya tetap tampil dengan isinya utuh, di urutan waktunya sendiri, sebagai butir
tingkat atas. Menghilangkan kalimat yang ditulis orang karena peristiwa LAIN dihapus
adalah kehilangan yang lebih mahal daripada satu butir yang tampak ganjil.

## Langkah 1 — apa yang benar-benar dibuktikan (21 Sep 2026)

Migrasi `20260921_balasan_komentar.sql` **sudah diterapkan** ke proyek produksi
`lzamazdfaidxuohhzpjd` lewat Management API (token CLI). `supabase db push` tidak dipakai:
riwayat migrasi awan (57 entri) belum pernah ditarik ke repo, dan `migration repair` buta
atas 57 entri ditolak sebagai jalan yang terlalu berisiko.

⚠️ **Koreksi terhadap draf rencana.** SQL verbatim di `catatan/21` menulis ulang kedua
trigger TANPA dua penjagaan yang sudah hidup di `20260910d`:

1. pengisian salinan `nama_penulis` + `peran_penulis` saat insert (dan pemakuannya saat
   sunting) — tanpa ini SEMUA komentar baru lahir tanpa penulis;
2. cek `v_saya is null` ("Sesi tidak dikenali").

Versi gabungan yang benar sudah terpasang; draf verbatim sempat terpasang beberapa menit
lalu digantikan. Berkas migrasi di repo memuat versi gabungan dengan komentar asal-usulnya.

Keenam probe dijalankan di dalam transaksi lalu `rollback`, dengan
`set local role authenticated` + klaim JWT peran (kecuali 6b yang sengaja jalan sebagai
`postgres` — yang diuji di sana TRIGGER, bukan RLS):

| # | Probe | Hasil |
|---|---|---|
| 1 | Sales polos (`sales` saja) membalas di PO milik sales lain | **DITOLAK** — `42501 new row violates row-level security policy for table "po_komentar"` |
| 2 | C Level (`c_level`) membalas | **DITOLAK** — `23514 Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.` |
| 3 | `induk_kunci` menunjuk komentar milik PO lain | **DITOLAK** — `23514 Balasan harus berada di PO yang sama dengan komentar yang dibalas.` |
| 4 | Klien mengirim `kedalaman = 0` pada balasan tingkat tiga | **DITERIMA tapi DIABAIKAN** — tersimpan `kedalaman = 3` (A=0, B=1, C=2, D=3) |
| 5 | Kedalaman 51 | **DITOLAK** — `23514 Balasan sudah bersarang 50 tingkat. Mulai utas baru di tingkat atas.` |
| 6a | `update po_komentar set induk_kunci = …` lewat jalur authenticated | **DITOLAK** — `42501 permission denied for table po_komentar` (GRANT UPDATE sudah dicabut, lebih kuat dari RLS) |
| 6b | `update … set induk_kunci='komentar:palsu', kedalaman=99` (jalur postgres, uji trigger) | **DIPAKU** — tetap `induk_kunci = null`, `kedalaman = 0` |

Kesimpulan: penetapan induk hanya bisa saat insert, hanya bisa menunjuk baris yang sudah
ada, dan tidak bisa diubah sesudahnya — rantai yang hanya tumbuh ke arah masa lalu, jadi
siklus mustahil. Sesuai janji spesifikasi.

## Skema

```sql
alter table po_komentar
  add column if not exists induk_kunci text,
  add column if not exists kedalaman   integer not null default 0;

create index if not exists po_komentar_induk on po_komentar (po_id, induk_kunci);
```

`induk_kunci` null = komentar tingkat atas, persis seperti hari ini. Seluruh baris yang
sudah ada di produksi otomatis benar tanpa backfill.

`kedalaman` diisi trigger, bukan klien: induk + 1, atau 0 bila `induk_kunci` null atau
bukan kunci komentar. Disimpan supaya render tidak perlu menelusuri rantai ke atas, dan
supaya ada tempat menegakkan pagar keamanan di bawah.

### Yang ditambahkan ke `private.jaga_komentar_baru()`

Trigger yang sudah ada mengambil `oleh`, `waktu`, dan `versi_po` dari kenyataan server.
Tiga hal menyusul:

1. **`induk_kunci` yang menunjuk komentar wajib komentar di PO YANG SAMA.** Untuk kunci
   berbentuk `komentar:<uuid>`, uuid-nya dicari dan `po_id`-nya dibandingkan dengan
   `new.po_id`. Tidak cocok → ditolak. Tanpa ini, balasan bisa ditambatkan ke komentar di
   PO lain; itu tidak membocorkan apa pun (render selalu per-PO, kuncinya tidak akan
   ketemu dan jadi nisan) tapi ia data sampah yang menunggu jadi kebingungan.
2. **`kedalaman` dihitung server.** Induk komentar → `induk.kedalaman + 1`. Selain itu 0.
3. **Pagar kedalaman 50.** Bukan pembatasan percakapan — lima puluh balasan berantai
   bukan percakapan manusia, dan tanpa batas apa pun, render rekursif dan kueri rekursif
   tidak punya langit-langit. Melewatinya ditolak dengan kalimat yang bisa dibaca.

### Kenapa siklus mustahil

`update` dan `delete` pada `po_komentar` **sudah dicabut** dari `anon` dan `authenticated`
(`20260910_komentar_po.sql`), dan `private.jaga_komentar_sunting()` mengembalikan kolom
selain isi ke nilai lama.

Fungsi itu **harus diperluas** di tugas 1: ia hari ini memaku `id`, `po_id`, `oleh`,
`waktu`, dan `versi_po` satu per satu, jadi kolom baru TIDAK ikut terpaku dengan
sendirinya. `induk_kunci` dan `kedalaman` wajib ditambahkan ke daftar itu. Ini pola yang
sudah menggigit di proyek ini — `private.bekukan_isi_po` juga membekukan lewat daftar
kolom eksplisit, dan kolom baru yang lupa didaftarkan tetap bisa diubah lewat PostgREST.

Artinya induk hanya bisa ditetapkan SAAT INSERT, dan hanya bisa menunjuk baris yang sudah
ada lebih dulu. Rantai yang hanya tumbuh ke arah masa lalu tidak bisa melingkar. Ini
jaminan struktural, bukan pemeriksaan yang bisa lupa dipanggil — dan itu sebabnya tidak
ada `with recursive` penjaga siklus di mana pun.

## RLS

**Tidak ada kebijakan baru.** Balasan adalah baris `po_komentar`; `komentar_lihat` dan
`komentar_tulis` berlaku apa adanya, termasuk penolakan `c_level` harfiah lewat
`private.peran_saya()` (bukan `punya_peran`, yang meloloskan Super Admin — lihat catatan
panjang di migrasi aslinya).

Yang HARUS diperiksa ulang oleh uji, karena mudah dikira sudah beres:

- Sales polos tetap tidak bisa membalas di PO milik orang lain.
- C Level tetap tidak bisa membalas, walau ia boleh membaca seluruh utas.
- Balasan tidak bisa disisipkan atas nama orang lain (`oleh` dipaksa trigger).
- `induk_kunci` dan `kedalaman` tidak bisa diubah lewat PostgREST sesudah tersimpan.

## Lini masa jadi pohon

`liniMasa()` sekarang mengembalikan larik datar terurut. Ia menjadi pohon:

```ts
export type Peristiwa = {
  kunci: string;          // BARU — penambat balasan
  waktu: string;
  warna: string;
  judul: string;
  rincian?: string;
  oleh?: string | null;
  komentar?: KomentarLini;
  balasan: Peristiwa[];   // BARU — terlama di atas
};
```

Balasan memakai bentuk `Peristiwa` yang sama supaya render bisa rekursif tanpa dua jenis
butir.

**Urutan, dan kenapa dua arah:**

- Peristiwa tingkat atas: **terbaru di atas**, seperti sekarang. Lini masa dibaca untuk
  "apa yang terakhir terjadi".
- Balasan di dalam satu utas: **terlama di atas**. Percakapan dibaca dari awal; membalik
  balasan membuat jawaban muncul sebelum pertanyaannya.

Ketidakkonsistenan ini disengaja dan harus DIKATAKAN di layar, bukan dibiarkan jadi
kejutan.

**Komentar yang menjadi balasan tidak lagi muncul sebagai butir tingkat atas.** Ia pindah
ke bawah induknya. Balasan yatim (induknya tidak ketemu) kembali ke tingkat atas, dengan
nisan.

## Lencana dan "bolanya di siapa"

`lib/komentar.ts` `penulisTerakhir()` **tidak berubah**: ia membaca larik `po_komentar`
mentah, dan balasan ada di tabel yang sama. Balasan otomatis ikut dihitung sebagai "yang
terakhir bicara", dan memang seharusnya begitu.

Yang BERUBAH ada di `app/(sistem)/po/[id]/page.tsx`: `komentarBaru(e)` dan `adaBaru`
sekarang hanya memeriksa butir tingkat atas. Keduanya wajib menelusuri `balasan` secara
rekursif, atau balasan baru tidak pernah menyalakan lencana "baru" dan PO tampak sudah
terbaca padahal ada yang menunggu jawaban. Ini kegagalan yang paling mungkin lolos ke
produksi tanpa ketahuan, karena layarnya tetap tampak benar.

## Layar

- Tombol **Balas** pada setiap butir lini masa, di sebelah waktunya. Hanya muncul bagi
  yang `bolehKomentar()`.
- Diklik → kotak tulis terbuka di bawah butir itu, dengan tombol Batal. **Beberapa kotak
  boleh terbuka bersamaan**, masing-masing menyimpan isiannya sendiri. Rancangan awal
  "satu kotak pada satu waktu" dibatalkan 21 Sep 2026 saat menulis rencana kerja: menutup
  kotak lain berarti MEMBUANG kalimat yang sudah diketik orang di sana, dan tidak ada
  yang lebih menyebalkan daripada itu. Lagi pula menutupnya butuh state bersama seluruh
  lini masa — lebih rumit, demi hasil yang lebih buruk.
- Balasan menjorok. **Indent berhenti di tingkat 4**; lebih dalam ditampilkan rata pada
  tingkat 4 dengan penanda kecil. Di 375px, empat tingkat sudah memakan hampir seluruh
  lebar, dan tingkat kelima akan menyisakan kolom teks selebar dua karakter. Datanya tetap
  tanpa batas; yang dibatasi hanya jorokannya.
- Kalimat `KotakKomentar` diganti. Sekarang: "Utas ini satu dan terbuka." Menjadi kira-kira:
  "Semua yang bisa melihat PO ini membaca komentar dan balasannya. Tidak ada bagian yang
  tersembunyi." — menjaga maksud aslinya tanpa menjanjikan kedataran.
- Nisan balasan yatim memakai gaya `.komentar-dihapus` yang sudah ada.

## Uji yang wajib ada

Mengikuti pola `uji/komentar-rls.test.mjs`, yang membuktikan penjaganya dengan **uji
mutasi** — mengubah berkas migrasinya lalu memastikan penjagaan yang hilang tertangkap.

**Murni (`lib/lini-masa.ts`), tanpa basis data:**
1. `kunciPeristiwa()` stabil: masukan sama → kunci sama, dua kali render berturut-turut.
2. Tanda tangan yang dihapus lalu dibubuhkan ulang oleh pihak yang sama menghasilkan
   kunci BERBEDA. Ini kaidah paling penting di seluruh spesifikasi ini; kalau ia jebol,
   percakapan menempel ke peristiwa yang salah tanpa suara.
3. Balasan bersarang tersusun sebagai pohon, terlama di atas, sementara tingkat atas tetap
   terbaru di atas.
4. Balasan yang induknya tidak ada kembali ke tingkat atas, ditandai yatim.
5. Komentar yang menjadi balasan TIDAK muncul dua kali (di tingkat atas dan di dalam utas).
6. Rantai dalam (20 tingkat) tersusun benar dan tidak menghabiskan tumpukan.

**Bentuk migrasi (`uji/komentar-rls.test.mjs` diperluas), tanpa koneksi:**

Tidak ada satu pun uji di repo ini yang menyambung basis data — `npm run uji` harus jalan
tanpa kredensial. `komentar-rls.test.mjs` menjaga sisi yang bisa diperiksa tanpa koneksi:
**bentuk aturannya**, dibaca dari berkas migrasi. Ia tidak membuktikan basis datanya
benar; ia menangkap saat seseorang kelak "merapikan" migrasinya dan diam-diam membuka
pintu yang sengaja ditutup. Berkas baru dibaca dengan `migrasiTerakhir()` dari
`uji/migrasi.mjs`, BUKAN nama berkas yang dipatok — uji yang memaku nama migrasi adalah
jimat, bukan penjaga, dan itu sudah menggigit tiga kali di proyek ini.

7. Pemeriksaan PO-sama untuk `induk_kunci` berbentuk `komentar:` ada di trigger.
8. `kedalaman` di-set dari induk di trigger, tidak pernah dari `new.kedalaman`.
9. Pagar kedalaman 50 ada, dan pesannya bukan pesan Postgres mentah.
10. `jaga_komentar_sunting()` memaku `induk_kunci` DAN `kedalaman` ke nilai lama —
    diperiksa per kolom, bukan dengan mencari kata "induk" di mana saja dalam berkas.
11. Tidak ada kebijakan `UPDATE`/`DELETE` baru pada `po_komentar`, dan pencabutannya
    masih berdiri.
12. Pemeriksaan `c_level` masih harfiah lewat `peran_saya()` di kebijakan DAN trigger
    (dua kali, seperti sekarang) — memastikan migrasi baru tidak menulis ulang trigger
    lama tanpa penjagaannya.

**Bukti basis data, manual, sekali saat membangun (tugas 1):**

Pola yang sama dengan `catatan/09` dan diagnostik 30 Agu 2026: serangan disimulasikan di
dalam transaksi dengan `set local role authenticated` + klaim JWT peran, ditunjukkan
DITOLAK, lalu `rollback`. Hasilnya dicatat di bagian "Langkah 1 — apa yang benar-benar
dibuktikan" di bawah spesifikasi ini, bukan jadi uji otomatis.

Yang wajib dibuktikan begitu: Sales polos gagal membalas di PO orang lain; C Level gagal
membalas; `induk_kunci` menunjuk komentar milik PO lain ditolak; `kedalaman` kiriman klien
diabaikan; kedalaman 51 ditolak; `induk_kunci` tidak berubah lewat jalur sunting.

**Layar:**
13. Lencana "baru" menyala untuk balasan bersarang — pratinjau `uji/pratinjau-komentar.tsx`
    diperluas dengan utas bersarang, dua tema, dan dilihat di 375px.

## Di luar lingkup

- **Pemberitahuan keluar.** Tetap lencana dalam aplikasi saja (`catatan/09` keputusan #4).
- **Menyebut orang (`@nama`).** Tidak sekarang; ia menyeret pemberitahuan.
- **Melipat utas panjang** ("tampilkan 12 balasan lainnya"). Ditambahkan kalau utas
  sungguhan memang jadi panjang, bukan diantisipasi.
- **Memindahkan balasan ke induk lain.** Tidak ada jalur sunting induk sama sekali; itu
  justru yang membuat siklus mustahil.
- **Membalas dari halaman lain** (daftar PO, beranda). Hanya di halaman PO.

## Risiko yang diterima

`catatan/09` menyatakan terang-terangan bahwa komentar **tidak menggantikan**
`verifikasi.catatan`: alasan sebuah keputusan menempel pada keputusannya, dan ikut basi
bersamanya.

Membalas tepat di bawah sebuah keputusan mengaburkan garis itu. Alasan sebenarnya sebuah
penolakan bisa berakhir di utas balasan, bukan di `catatan` — dan yang membaca PKS,
Surat Verifikasi, atau jejak audit tidak melihat utas. Risiko ini diterima sadar; yang
bisa dilakukan kode hanyalah tidak memancingnya, yaitu **tidak** menaruh kotak balas
sebagai tindakan utama pada butir keputusan verifikasi.

Ditinjau ulang kalau ternyata `verifikasi.catatan` mulai kosong sementara utasnya panjang.

## Urutan pengerjaan

| # | Tugas |
|---|---|
| 1 | Migrasi: kolom, indeks, trigger, pagar kedalaman. Tidak mengubah apa pun yang terlihat |
| 2 | Uji RLS dan trigger (butir 7–12), termasuk uji mutasinya |
| 3 | `lib/lini-masa.ts`: `kunciPeristiwa()`, `Peristiwa.kunci`, `Peristiwa.balasan`, penyusunan pohon. Uji murni (butir 1–6) |
| 4 | Aksi server `balasKomentar()` di `lib/po-aksi.ts` |
| 5 | Layar: tombol Balas, kotak bersarang, indent bertingkat, nisan, kalimat baru |
| 6 | Lencana rekursif + pratinjau bersarang (butir 13) |

Tugas 1–3 tidak mengubah apa pun yang terlihat, sama seperti langkah 1 `catatan/09`.

## Catatan pembangunan (21 Sep 2026)

Keenam tugas selesai di cabang `build/balasan-komentar`. QA independen menyatakan
**PASS** (0 Critical, 0 Important, 1 Minor). `npm run periksa` 33/33 hijau, `npm run build`
exit 0. **Belum di-commit** — diputuskan Rizki agar commit/deploy dilanjutkan Claude Code;
lihat `.superpowers/sdd/21-rencana-balasan-komentar/handoff-claude-code.md`.

Dua hal yang menyimpang dari rencana dan perlu diketahui pembaca berikutnya:

1. Trigger di migrasi `20260921_balasan_komentar.sql` adalah versi GABUNGAN dengan
   penjagaan dari `20260910d` (salinan `nama_penulis`/`peran_penulis` saat insert,
   pemakuannya saat sunting, dan tolak sesi tanpa email). Rencana keliru menghilangkannya.
2. **Keputusan desain terbuka:** pada lebar 375px, utas ≥4 tingkat meluber mendatar,
   karena offset indent MENJUMLAH antar tingkat (kedalaman 4 ≈ 99px, kedalaman 5 ≈ 196px).
   `INDENT_MAKS=4` hanya memagari margin per tingkat, bukan total kumulatif. Niat rencana
   adalah tingkat 4 masih muat; kenyataannya tidak. Perbaikan mengubah skema indent →
   menunggu keputusan Rizki.
