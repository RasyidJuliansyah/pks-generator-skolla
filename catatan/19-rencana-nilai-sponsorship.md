# Rencana Kerja: Nilai sponsorship dan batas 15%

Melaksanakan `catatan/18-spesifikasi-nilai-sponsorship.md` (disetujui Rizki 17 Sep 2026).
Spesifikasi itu dibaca bersama rencana ini — rencana ini berdebat DARI spesifikasi, bukan
menggantikannya. Aturan IoM yang disentuh ada di `catatan/13a`, Bagian 8.

**Keadaan awal, diperiksa langsung 20 Sep 2026:**

| Hal | Keadaan sekarang |
|---|---|
| `VERSI_IOM` (`lib/iom.ts:` konstanta) | `iom-2026-09-17b` |
| `private.versi_iom_berlaku()` | mengembalikan `'iom-2026-09-17b'` |
| Aturan lama | `lib/iom.ts:114` `cek('tanpa-sponsorship', !f.adaSponsorship, …)` |
| Fakta lama | `lib/iom.ts:39` `adaSponsorship: boolean` |
| Aturan SQL lama | `private.nilai_iom` → `aturan_iom('tanpa-sponsorship', not exists(…po_catatan…), 'catatan sponsorship')` |
| `po.nilai_sponsorship` | **belum ada** |
| `po.grand_total` / `po.versi` / `po.versi_iom` | `bigint` / `integer` / `text`, sudah ada |
| Trigger keluar draf | `po_syarat_maju` → fungsi `jaga_syarat_maju` (sudah ada) |
| Gerbang unggah PKS | `public.unggah_pks_basah` (sudah ada) |
| Wilayah perubahan `sponsorship` | `lib/po-aksi.ts:340-342` |
| Verdict di produksi | **nol** — tidak ada verdict lama yang perlu dipindahkan |
| PO di produksi | 2 (PO-001 `pks_terbit`, PO-067 `verifikasi`), keduanya ada catatan sponsorship tanpa nilai, tidak ada draf |

## Batasan global

Berlaku untuk SETIAP tugas di bawah; tidak diulang per tugas.

1. **Rumus batas bilangan bulat, tidak pernah pecahan:**
   `nilai_sponsorship * 100 <= grand_total * 15`. Sama persis di TypeScript dan SQL.
   Jangan memakai `* 0.15` di mana pun — pembulatan tidak boleh ikut menentukan hasil.
2. **Batas yang ditampilkan** dihitung `floor(grand_total * 15 / 100)`, hanya untuk dibaca
   orang. Yang menentukan lolos/gagal tetap rumus butir 1.
3. **TS dan SQL wajib sama.** Setiap perubahan kode aturan menyentuh `lib/iom.ts` DAN
   `private.nilai_iom` dalam satu commit. `uji/iom.test.mjs` yang sudah ada menjaganya.
4. **Bukti basis data dibuktikan dalam transaksi yang dibatalkan** — `begin; set local role
   authenticated; set local request.jwt.claims = …; …; rollback;`. Tunjukkan LOLOS sebelum
   perbaikan dan DITOLAK sesudahnya, lalu `rollback`. Pola ini wajib, lihat
   `supabase/migrasi/README.md`.
5. **Peran harfiah.** Penulis konfirmasi dokumen sponsorship adalah `finance` HARFIAH — pakai
   `private.peran_saya()`, BUKAN `private.punya_peran('finance')`, karena Super Admin lolos
   `punya_peran` untuk peran apa pun dan itu bukan yang dimaksud spesifikasi.
6. **Migrasi ditulis sebagai berkas di `supabase/migrasi/`** dengan nama
   `20260920<huruf>_<topik>.sql`, diterapkan lewat Management API, dan berkasnya adalah
   catatan tertulis — bukan yang dijalankan CLI. JANGAN `supabase db push`: riwayat migrasi
   CLI tidak pernah dipakai proyek ini (36 migrasi remote, 0 lokal).
7. **Tema ganda dan 44px.** Setiap layar baru diperiksa di tema terang dan gelap, lebar 1200
   dan 375. Target sentuh minimal 44px di layar sempit.
8. **Teks disaring `DESIGN.md` dan antislop.**
9. **`npm run periksa` hijau sebelum setiap commit.** Build + `postbuild` (pemindai bundel)
   hijau sebelum deploy.
10. **Acquisition Price tidak boleh menyentuh komponen klien.** Tabel rujukan di
    `catatan/18` sengaja tanpa Acquisition; jangan menambahkannya.

## Peta berkas

**Basis data (migrasi)**
- `supabase/migrasi/20260920a_nilai_sponsorship.sql` — kolom, syarat keluar draf.
- `supabase/migrasi/20260920b_aturan_sponsorship_dalam_batas.sql` — aturan IoM TS/SQL, versi.
- `supabase/migrasi/20260920c_dokumen_sponsorship_pks.sql` — tabel, RLS, gerbang unggah.

**Logika**
- `lib/iom.ts` — fakta `catatanSponsorship`/`nilaiSponsorship`, aturan baru, `VERSI_IOM`.
- `lib/verdict-iom.ts` — label aturan baru.
- `lib/po-aksi.ts:340-342` — nilai ikut wilayah `sponsorship`.
- `lib/dokumen-po.ts` — baris "Nilai: Rp…" di Form PO tercetak.

**Layar**
- `app/(sistem)/po/baru/langkah/penanda.tsx` — isian nilai, batas hidup, kotak kuning, halangan.
- `app/(sistem)/po/[id]/page.tsx` — nilai, persen, batas.
- `app/(sistem)/po/[id]/panel-verifikasi.tsx` — kartu Finance.
- `app/(sistem)/pks/[id]/` — kotak Dokumen Sponsorship + pesan tombol unggah.

**Uji**
- `uji/iom.test.mjs` — tujuh kasus aturan murni + kesamaan TS/SQL.
- `uji/syarat-maju.test.mjs` — syarat keluar draf.
- `uji/rujukan-sponsorship.test.mjs` — **baru**, tabel di `catatan/18` dihitung ulang.
- `uji/pratinjau-sponsorship.tsx` — **baru**, pratinjau isian dan kotak.

---

### Tugas 1: Kolom `nilai_sponsorship`, syarat keluar draf, pelacakan perubahan

**Berkas**
- Buat: `supabase/migrasi/20260920a_nilai_sponsorship.sql`
- Ubah: `lib/po-aksi.ts:340-342`
- Uji: `uji/syarat-maju.test.mjs`

**Menghasilkan untuk tugas berikutnya:** kolom `po.nilai_sponsorship bigint null`, dan
jaminan bahwa PO berstempel IoM baru tidak bisa keluar draf dengan catatan-tanpa-nilai atau
nilai-tanpa-catatan.

- [ ] **Langkah 1: Buktikan dulu keadaan sekarang membolehkan yang salah**

Dalam transaksi yang dibatalkan, tunjukkan sebuah PO draf berstempel IoM bisa maju dengan
catatan sponsorship berisi dan tanpa nilai. Ini bukti "sebelum" yang wajib menurut Batasan 4.

- [ ] **Langkah 2: Tulis migrasi kolom**

```sql
alter table po
  add column nilai_sponsorship bigint
  check (nilai_sponsorship is null or nilai_sponsorship >= 0);

comment on column po.nilai_sponsorship is
  'Nilai sponsorship dalam Rupiah utuh, satu angka total termasuk barang dan media '
  'dengan harga pokoknya bagi Skolla. Rinciannya tetap di po_catatan jenis sponsorship. '
  'Batas kepatuhan 15% dari grand_total diperiksa aturan IoM sponsorship-dalam-batas.';
```

- [ ] **Langkah 3: Tambahkan syarat berpasangan ke `jaga_syarat_maju`**

Baca dulu definisi utuhnya (`select pg_get_functiondef('private.jaga_syarat_maju'::regproc)`)
dan sisipkan pada jalur keluar draf yang sudah ada — JANGAN menulis ulang fungsinya. Syaratnya
hanya berlaku bila `new.versi_iom = private.versi_iom_berlaku()`, supaya PO lama tidak tertahan:

```sql
if new.versi_iom = private.versi_iom_berlaku() then
  if exists (select 1 from po_catatan
             where po_id = new.id and jenis = 'sponsorship' and btrim(coalesce(isi,'')) <> '')
     and coalesce(new.nilai_sponsorship, 0) = 0 then
    raise exception 'Catatan sponsorship ada, tapi nilainya belum diisi.';
  end if;
  if coalesce(new.nilai_sponsorship, 0) > 0
     and not exists (select 1 from po_catatan
                     where po_id = new.id and jenis = 'sponsorship'
                       and btrim(coalesce(isi,'')) <> '') then
    raise exception 'Nilai sponsorship ada, tapi catatannya belum diisi.';
  end if;
end if;
```

- [ ] **Langkah 4: Nilai ikut wilayah `sponsorship` di `lib/po-aksi.ts`**

Di sekitar baris 340-342 wilayah `sponsorship` sekarang hanya membandingkan teks catatan.
Tambahkan nilainya ke penanda yang sama, sehingga nilai yang berubah membasikan keputusan
Finance dan menaikkan `po.versi` — sama seperti teksnya.

- [ ] **Langkah 5: Masukkan kolom baru ke `private.bekukan_isi_po`**

⚠️ **Jangan dilewati.** Fungsi itu membekukan dengan DAFTAR KOLOM EKSPLISIT — sepasang tuple
`(NEW.sekolah_id, …, NEW.grand_total, …, NEW.versi_iom) is distinct from (OLD.…)` — bukan
perbandingan seluruh baris. Kolom baru TIDAK ikut beku dengan sendirinya. Kalau
`nilai_sponsorship` tidak ditambahkan ke KEDUA tuple, nilai sponsorship PO yang sudah
ditandatangani bisa diubah lewat PostgREST sementara tanda tangannya tetap menempel — bentuk
yang sama persis dengan temuan `grand_total` diganti 777777 pada diagnostik 30 Agu 2026.

Tambahkan `NEW.nilai_sponsorship` dan `OLD.nilai_sponsorship` pada posisi yang sama di kedua
tuple.

- [ ] **Langkah 6: Buktikan sesudahnya**

Dalam transaksi yang dibatalkan, semuanya:
catatan tanpa nilai **ditolak**; nilai tanpa catatan **ditolak**; keduanya terisi **diterima**;
`nilai_sponsorship = -1` **ditolak oleh check**; PO berstempel `iom-2026-09-17b`
**tidak dituntut**; mengubah nilai pada PO terverifikasi **menaikkan `versi` dan membasikan
keputusan Finance**; dan — bukti untuk Langkah 5 — mengubah `nilai_sponsorship` pada PO
berstatus `ditandatangani` **ditolak** (tunjukkan LOLOS sebelum Langkah 5, DITOLAK sesudahnya).
Lalu `rollback`.

- [ ] **Langkah 7: `npm run periksa`, lalu commit**

---

### Tugas 2: Aturan `sponsorship-dalam-batas` di TypeScript dan SQL

Satu migrasi, satu commit — spesifikasi menuntut ini, karena TS dan SQL yang berbeda versi
berarti verdict yang berbeda untuk PO yang sama.

**Berkas**
- Buat: `supabase/migrasi/20260920b_aturan_sponsorship_dalam_batas.sql`
- Ubah: `lib/iom.ts` (fakta baris 39, aturan baris 114, `VERSI_IOM`), `lib/verdict-iom.ts`
- Buat: `uji/rujukan-sponsorship.test.mjs`
- Uji: `uji/iom.test.mjs`

**Mengonsumsi dari Tugas 1:** kolom `po.nilai_sponsorship`.
**Menghasilkan:** `VERSI_IOM = 'iom-2026-09-17c'`, kode aturan `sponsorship-dalam-batas`,
fakta `catatanSponsorship: boolean` dan `nilaiSponsorship: number | null`.

- [ ] **Langkah 1: Tulis tujuh kasus uji yang gagal dulu**

Di `uji/iom.test.mjs`, persis tujuh kasus dari `catatan/18` bagian Uji butir 1:
tanpa sponsorship **lolos**; tepat 15% **lolos**; satu Rupiah di atas **gagal**; catatan tanpa
nilai **gagal**; nilai tanpa catatan **gagal**; bukti memuat nominal, persen, dan batas;
grand total 0 dengan nilai > 0 **gagal**.

- [ ] **Langkah 2: Jalankan, pastikan GAGAL**

`node uji/iom.test.mjs` — harus gagal karena fakta dan kode aturannya belum ada.

- [ ] **Langkah 3: Ganti fakta dan aturan di `lib/iom.ts`**

Fakta (menggantikan `adaSponsorship: boolean` di baris 39):

```ts
  /** Ada po_catatan jenis 'sponsorship' yang berisi. */
  catatanSponsorship: boolean;
  /** po.nilai_sponsorship; null berarti belum diisi. */
  nilaiSponsorship: number | null;
```

Aturan (menggantikan baris 114):

```ts
  const nilaiSp = f.nilaiSponsorship ?? 0;
  const adaNilai = nilaiSp > 0;
  const batasSp = Math.floor((f.grandTotal * 15) / 100);
  const buktiSp =
    !f.catatanSponsorship && !adaNilai ? 'tidak ada'
    : f.catatanSponsorship !== adaNilai ? 'catatan dan nilai sponsorship tidak berpasangan'
    : `${rp(nilaiSp)} = ${persenSp(nilaiSp, f.grandTotal)} dari ${rp(f.grandTotal)}, batas ${rp(batasSp)}`;
  cek('sponsorship-dalam-batas',
    !f.catatanSponsorship && !adaNilai
      ? true
      : f.catatanSponsorship === adaNilai && nilaiSp * 100 <= f.grandTotal * 15,
    buktiSp);
```

⚠️ `lib/iom.ts` **belum mengimpor `rp`** — impornya hari ini hanya `./pricelist` (type),
`./aturan-komponen`, dan `./hitung`, dan seluruh buktinya memakai angka mentah. Putuskan satu:
impor `rp` dari `./format`, ATAU tulis pemformat kecil di dalam `lib/iom.ts`. Apa pun
pilihannya, jalankan `uji/batas-harga.test.mjs` sesudahnya — penjaga graf impor itu yang
menahan harga Acquisition agar tidak terseret ke bundel klien, dan `lib/iom.ts` ikut dipakai
komponen klien. `persenSp` memberi satu angka desimal dengan koma, contoh `15,0%`. Grand total 0 dengan nilai
> 0 gagal sendirinya: `nilai * 100 > 0 = 0 * 15`.

Naikkan `VERSI_IOM` menjadi `'iom-2026-09-17c'`.

- [ ] **Langkah 4: Label di `lib/verdict-iom.ts`**

```ts
  'sponsorship-dalam-batas': 'Sponsorship dalam batas 15%',
```

Hapus entri `'tanpa-sponsorship'`.

- [ ] **Langkah 5: Jalankan, pastikan LOLOS**

- [ ] **Langkah 6: Aturan yang sama di SQL**

Di `private.nilai_iom`, ganti blok `aturan_iom('tanpa-sponsorship', …)` dengan
`sponsorship-dalam-batas` yang memakai rumus bilangan bulat yang sama dan menyusun bukti
dengan bentuk teks yang sama. Ubah `private.versi_iom_berlaku()` menjadi
`select 'iom-2026-09-17c'::text`.

- [ ] **Langkah 7: Buktikan TS dan SQL sama**

Dalam transaksi yang dibatalkan, untuk kasus batas (tepat 15% dan lebih satu Rupiah): hasil
`private.nilai_iom` sama dengan hasil `lib/iom.ts` — kode aturan, lolos/gagal, dan bunyi
buktinya.

- [ ] **Langkah 8: Uji tabel rujukan**

`uji/rujukan-sponsorship.test.mjs` membaca tabel Markdown di `catatan/18` dan menghitung ulang
setiap angka dari `KOMPONEN` dan `PRESET` di `lib/pricelist.ts` (15% = `floor(harga*15/100)`).
Tujuannya: harga berubah tanpa tabel diperbarui harus JATUH di uji, bukan diam-diam menyesatkan
Sales. Sertakan penjaga `assert.ok(baris.length > 0)` — parser tabel yang rusak dan membaca nol
baris pernah memberi hijau palsu di `uji/pricelist.test.mjs`.

- [ ] **Langkah 9: `npm run periksa`, lalu commit** (satu commit dengan migrasinya)

---

### Tugas 3: Tabel `pks_dokumen_sponsorship` dan gerbang unggah PKS basah

**Berkas**
- Buat: `supabase/migrasi/20260920c_dokumen_sponsorship_pks.sql`

**Mengonsumsi:** `po.nilai_sponsorship` (Tugas 1).
**Menghasilkan:** tabel konfirmasi, dan `unggah_pks_basah` yang menolak PO bersponsorship
tanpa konfirmasi berlaku.

- [ ] **Langkah 1: Buktikan sekarang unggahan lolos tanpa konfirmasi**

- [ ] **Langkah 2: Tabel dan RLS**

```sql
create table pks_dokumen_sponsorship (
  po_id uuid primary key references po(id) on delete cascade,
  versi_po integer not null,
  form_ditandatangani boolean not null,
  rekening_atas_nama_lembaga boolean not null,
  meterai_bila_di_atas_5juta boolean not null,
  oleh text not null,
  pada timestamptz not null default now()
);
alter table pks_dokumen_sponsorship enable row level security;
```

Tulis: HANYA peran harfiah `finance` (`'finance' = any(private.peran_saya())`), dan `versi_po`
yang disisipkan wajib sama dengan `po.versi` saat itu — `WITH CHECK`, bukan sekadar aturan
aplikasi. Baca: siapa pun yang boleh melihat PO-nya.

- [ ] **Langkah 3: Gerbang di `unggah_pks_basah`**

Baca definisi utuhnya dulu (1317 karakter) dan sisipkan syarat: bila PO punya catatan
sponsorship berisi ATAU `nilai_sponsorship > 0`, maka wajib ada baris
`pks_dokumen_sponsorship` dengan `versi_po = po.versi` sekarang dan **ketiga** centang `true`.
Bila tidak, tolak dengan kalimat yang bisa dibaca orang.

- [ ] **Langkah 4: Buktikan sesudahnya**

Dalam transaksi yang dibatalkan: tanpa konfirmasi **ditolak**; konfirmasi `versi_po` lama
**ditolak**; salah satu centang `false` **ditolak**; konfirmasi berlaku **diterima**; PO tanpa
sponsorship **tidak dituntut**; konfirmasi oleh peran selain `finance` (uji dengan `sales` dan
dengan `admin_utama`) **ditolak**.

- [ ] **Langkah 5: `npm run periksa`, lalu commit**

---

### Tugas 4: Layar wizard, halaman PO, dan Form PO tercetak

**Berkas**
- Ubah: `app/(sistem)/po/baru/langkah/penanda.tsx`, `app/(sistem)/po/[id]/page.tsx`,
  `app/(sistem)/po/[id]/panel-verifikasi.tsx`, `lib/dokumen-po.ts`
- Buat: `uji/pratinjau-sponsorship.tsx`

- [ ] **Langkah 1: Isian nilai di langkah Penanda tangan & catatan**

Di bawah catatan sponsorship: "Nilai sponsorship (Rp)", bantuan "Total nilai, termasuk barang
dan media dengan harga pokoknya bagi Skolla." Pakai komponen `InputAngka` yang sudah ada —
bidang angka terkendali yang memaksa string kosong jadi 0 membuat nol tidak bisa dihapus
("12" jadi "012"); jebakan ini sudah pernah menggigit, lihat `catatan/02`.

- [ ] **Langkah 2: Batas hidup dan kotak kuning**

Di bawah isian: "Batas 15%: Rp…" dihitung dari grand total yang sedang berjalan. Di atas batas:
kotak kuning "Di atas 15% dari total. PO ini akan diverifikasi manual." **Bukan galat** —
melewati batas hanya mengirim PO ke keempat fungsi, jadi jangan menghalangi langkahnya.

- [ ] **Langkah 3: Halangan langkah bila tidak berpasangan**

Catatan tanpa nilai, atau nilai tanpa catatan, menjadi halangan langkah lewat
`daftar-halangan.tsx` yang sudah ada — cermin dari trigger Tugas 1, bukan penggantinya.

- [ ] **Langkah 4: Halaman PO dan kartu Finance**

Nilai, persentasenya dari grand total, dan batasnya.

- [ ] **Langkah 5: Form PO tercetak**

Di `lib/dokumen-po.ts`, baris "Nilai: Rp…" di bawah isi catatan sponsorship, supaya sekolah
menandatangani angkanya. Ingat aturan cetak: `@media (max-width:…)` WAJIB `@media screen and`,
dan blok judul dokumen jangan memakai `<header>`.

- [ ] **Langkah 6: Pratinjau dan lihat dengan mata**

`uji/pratinjau-sponsorship.tsx` merender tiga keadaan (dalam batas, di atas batas, tidak
berpasangan) di dua tema, lalu `node uji/tangkap-layar.mjs`. Tata letak wajib DIPANDANG, bukan
dibayangkan — dua bug pernah lolos ke produksi karena dilewati.

- [ ] **Langkah 7: `npm run periksa`, lalu commit**

---

### Tugas 5: Kotak Dokumen Sponsorship di halaman PKS

**Berkas**
- Ubah: `app/(sistem)/pks/[id]/` (halaman dan komponennya)

- [ ] **Langkah 1: Kotak dengan tiga pernyataan**

Tampil bila PO punya catatan ATAU nilai sponsorship. Finance mencentang tiga pernyataan —
kalimatnya disalin apa adanya dari `catatan/18` — lalu menyimpan. Peran lain melihat statusnya,
tidak bisa menyunting.

- [ ] **Langkah 2: Pesan di tombol unggah PKS basah**

Bila konfirmasi belum ada atau sudah basi, tombolnya menjelaskan apa yang ditunggu. Penolakan
sungguhannya tetap di basis data (Tugas 3) — ini hanya supaya orang tidak menabrak dinding
tanpa penjelasan.

- [ ] **Langkah 3: Pratinjau dua tema, 1200 dan 375**

- [ ] **Langkah 4: `npm run periksa`, lalu commit**

---

### Tugas 6: Penyaring, QA independen, rilis

- [ ] **Langkah 1: `npm run periksa`** — tsc + seluruh uji hijau.
- [ ] **Langkah 2: `npm run build`** — `postbuild` menjalankan pemindai bundel; harus hijau.
- [ ] **Langkah 3: Periksa dua PO produksi**

PO-001 (`pks_terbit`, catatan tanpa nilai): unggahan PKS basahnya sekarang menunggu konfirmasi
Finance — pastikan itu yang terjadi, dan pesannya terbaca.
PO-067 (`verifikasi`, catatan tanpa nilai): tetap di keempat fungsi, tidak berubah.
Keduanya berstempel IoM lama, jadi syarat keluar draf tidak menuntut nilainya.

- [ ] **Langkah 4: QA independen** — wajib, dan bukan verifikasi saya sendiri.
- [ ] **Langkah 5: Deploy** `vercel --prod --yes`, lalu buktikan produksi memang memuat commit
  ini (bandingkan sidik berkas deployment dengan berkas lokal).
- [ ] **Langkah 6: Perbarui `catatan/13a` ke `iom-2026-09-17c` dan status `catatan/18`
  menjadi terbangun.**

## Di luar lingkup

Mengikuti `catatan/18`:

- Pengelolaan pembayaran sponsorship kepada sekolah.
- Templat Form Sponsorship, Form Hibah, dan Berita Acara — masih penahan peluncuran di
  `catatan/05`, dan menunggu tinjauan legal yang sama dengan pemberitahuan UU PDP.
- Rincian nilai per jenis (dana, barang, media).
- Rencana kerja `catatan/17` (ekstraksi scan) — disusun SESUDAH ini, karena `catatan/18`
  mengubah syaratnya.
