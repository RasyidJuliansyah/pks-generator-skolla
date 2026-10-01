# Rencana Kerja: Wizard Form PO

> **Untuk agen pelaksana:** WAJIB memakai superpowers:subagent-driven-development
> (disarankan) atau superpowers:executing-plans, tugas demi tugas. Langkah memakai
> kotak centang (`- [ ]`).

**Tujuan:** Form PO satu halaman menjadi wizard tujuh langkah untuk PO platform dan PO
unggahan, tanpa mengubah isi, aturan, maupun kiriman ke server.

**Arsitektur:** State dan turunannya dipindah utuh dari `form-po.tsx` ke hook
`use-form-po.ts`; JSX yang ada dipecah ke satu komponen per langkah; `form-po.tsx` jadi
kerangka wizard. Halangan diberi label langkah di sumbernya lewat fungsi murni. Kiriman
ke server disusun satu fungsi murni yang direkam hasilnya sebelum wizard dibangun.

**Teknologi:** Next.js 16 App Router, React 19, TypeScript, CSS `app/globals.css`, uji
node (`uji/*.test.mjs`, pemuat `uji/muat.mjs`), pratinjau `tsx` + Puppeteer
(`uji/tangkap-layar.mjs`).

**Spesifikasi:** `catatan/11-spesifikasi-wizard-po.md`. Baca juga `DESIGN.md` dan
`AGENTS.md` sebelum mulai.

## Batasan global

- Isi, aturan, dan kiriman ke server (`IsiPo`) **tidak berubah**. `uji/emas/*` dan
  rekaman kiriman `uji/emas/isi-po-*.json` wajib tetap identik.
- Antarmuka `FormPo` ke `po/baru/page.tsx` dan `po/[id]/page.tsx` tidak berubah; satu
  props opsional baru `mulaiDi` hanya untuk pratinjau.
- Urutan langkah: `cara` → `sekolah` → `paket` → `rombel` → `termin` → `penanda` → `tinjau`.
  `cara` hanya saat membuat PO baru.
- Teks layar tanpa tanda pisah panjang (em dash); titik dua, koma, atau kurung. Panah hanya
  untuk arah nyata: "← Kembali", "Lanjut →".
- Token `globals.css`; radius `--r`; satu `--shadow`; garis kiri 4px hanya kotak keadaan;
  lebar isi maks 1100px; target sentuh ≥44px di `@media screen and (max-width:520px)`;
  tanpa animasi, ikon, emoji; dua tema, bawaan terang.
- Aturan layar sempit selalu `@media screen and (...)`.
- `uji/tata-letak.test.mjs` tetap lolos: `.grid-po>*{min-width:0}`, `.kisi-rombel` dan
  `.po-dokumen` `overflow-x:auto`.
- Skill antislop dipakai sebagai penyaring untuk tampilan dan teks.
- Agen (termasuk QA) tidak membaca isi berkas `.env*`.
- Commit dengan path eksplisit; jangan `git add -A` (`.commandcode/` bukan milik proyek).

Nomor baris di bawah merujuk `app/(sistem)/po/baru/form-po.tsx` pada commit `51e5650`.

---

### Tugas 1: Penyusun kiriman sebagai fungsi murni, dan rekamannya

**Berkas:**
- Buat: `lib/isi-po-form.ts`
- Ubah: `app/(sistem)/po/baru/form-po.tsx:349-379` (isi objek `isi` di `simpan()`)
- Uji: `uji/isi-po.test.mjs`, rekaman `uji/emas/isi-po-{satu,berkelompok,unggahan}.json`

**Antarmuka:**
- Menghasilkan: `susunIsiPo(p: MasukanIsiPo): IsiPo` dan tipe `MasukanIsiPo`.

- [ ] **Langkah 1: Tulis `lib/isi-po-form.ts`** dengan badan PERSIS objek `isi` di
  `form-po.tsx:349-379`; setiap variabel luar menjadi bidang `p`.

```ts
import type { IsiPo } from './po-aksi';
import { ID_GURU } from './aturan-komponen';

/**
 * Kiriman ke simpanDraf, disusun dari keadaan form. Dipindah apa adanya dari simpan()
 * di form-po.tsx supaya bisa direkam dan dibuktikan tidak berubah saat form jadi wizard.
 */
export type MasukanIsiPo = {
  awalId?: string;
  adaAwal: boolean;
  pindaian: boolean;
  sekolah: IsiPo['sekolah'];
  pilihan: { id: string; sesi: number }[];
  /** null = PO satu kelompok. */
  kelompok: { nomor: number; nama?: string; hargaSiswa: number }[] | null;
  komponenKelompok: { id: string; sesi: number; kelompok: number }[];
  nomorKelompok: number[];
  nSiswa: number; guru: number; hSiswa: number; hGuru: number;
  lain: { masaMulai: string; masaSelesai: string; sumberDana: string; sumberDanaLain: string;
          kota: string; tanggalTtd: string; namaPm: string; namaSm: string; cat1: string; cat2: string };
  nRombel: number; barisKelas: number[]; kolomRombel: string[];
  rombel: Record<string, number>;
  kelompokKelas: (k: number) => number;
  termin: { urutan: number; tanggal?: string; nominal: number }[];
  asal: 'platform' | 'unggahan';
};

export function susunIsiPo(p: MasukanIsiPo): IsiPo {
  const bk = !!p.kelompok;
  return {
    id: p.awalId,
    pindaianBaru: p.adaAwal && p.pindaian,
    sekolah: p.sekolah,
    komponen: bk
      ? p.komponenKelompok.filter((x) => ID_GURU.includes(x.id) || p.nomorKelompok.includes(x.kelompok))
      : p.pilihan,
    jumlahSiswa: p.nSiswa,
    jumlahGuru: p.guru,
    hargaSiswa: bk ? 0 : p.hSiswa,
    hargaGuru: p.hGuru,
    masaMulai: p.lain.masaMulai || undefined,
    masaSelesai: p.lain.masaSelesai || undefined,
    sumberDana: p.lain.sumberDana,
    sumberDanaLain: p.lain.sumberDanaLain || undefined,
    kota: p.lain.kota,
    tanggalTtd: p.lain.tanggalTtd || undefined,
    namaPm: p.lain.namaPm || undefined,
    namaSm: p.lain.namaSm || undefined,
    jumlahRombel: p.nRombel,
    rombel: p.barisKelas.flatMap((k) => p.kolomRombel.map((r) => ({
      kelas: k, rombel: r, jumlah: p.rombel[`${k}-${r}`] || 0,
      ...(bk ? { kelompok: p.kelompokKelas(k) } : {}) }))),
    ...(bk ? { kelompok: p.kelompok!.map((k) => ({
      nomor: k.nomor, nama: k.nama?.trim() || undefined, hargaSiswa: k.hargaSiswa })) } : {}),
    termin: p.termin.filter((t) => t.nominal > 0 || t.tanggal),
    catatan: [
      { jenis: 'pelaksanaan' as const, isi: p.lain.cat1 },
      { jenis: 'sponsorship' as const, isi: p.lain.cat2 },
    ],
    asal: p.asal,
  };
}
```

  Catatan pemeriksa: `kelompok` di sini adalah `hk.kelompok` (harga efektif sesudah dua
  lintasan), sama dengan yang dikirim form sekarang; `nomorKelompok` = `kelompok.map(k =>
  k.nomor)` dari state.

- [ ] **Langkah 2: Ganti isi `simpan()`** (`form-po.tsx:349-379`) dengan:

```ts
    const isi: IsiPo = susunIsiPo({
      awalId: awal?.id, adaAwal: !!awal, pindaian: !!pindaian, sekolah, pilihan,
      kelompok: hk ? hk.kelompok.map((k) => ({ nomor: k.nomor, nama: k.nama, hargaSiswa: k.hargaSiswa })) : null,
      komponenKelompok, nomorKelompok: kelompok.map((k) => k.nomor),
      nSiswa, guru, hSiswa, hGuru, lain, nRombel, barisKelas, kolomRombel, rombel,
      kelompokKelas, termin, asal,
    });
```

  dan tambahkan `import { susunIsiPo } from '@/lib/isi-po-form';`.

- [ ] **Langkah 3: Tulis uji dan rekam.** `uji/isi-po.test.mjs`:

```js
// Kiriman form PO ke simpanDraf tidak boleh berubah saat form menjadi wizard
// (catatan/11). Direkam dari penyusun yang dipindah apa adanya dari simpan().
//   BUAT_EMAS=1 node uji/isi-po.test.mjs   hanya bila perubahan kiriman memang disengaja
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { susunIsiPo } = muat('isi-po-form');
const lain = { masaMulai: '2026-09-01', masaSelesai: '2027-08-31', sumberDana: 'BOS', sumberDanaLain: '',
  kota: 'Bekasi', tanggalTtd: '2026-09-12', namaPm: 'Agung Uji', namaSm: 'Zhurry Uji',
  cat1: 'Mulai semester ganjil.', cat2: '' };
const sekolah = { nama: 'SMA UJI', npsn: '20200001', jenjang: 'SMA', kepala_sekolah: 'Kepala Uji' };
const rombel = { '10-A': 100, '11-A': 100, '12-A': 60, '12-B': 40 };
const dasar = { awalId: 'po-1', adaAwal: true, pindaian: false, sekolah, lain, nRombel: 2,
  barisKelas: [10, 11, 12], kolomRombel: ['A', 'B'], rombel, guru: 20, hGuru: 150000,
  termin: [{ urutan: 1, tanggal: '2026-09-15', nominal: 0 }, { urutan: 2, tanggal: '', nominal: 0 }] };

const KASUS = {
  satu: { ...dasar, asal: 'platform', kelompok: null, komponenKelompok: [], nomorKelompok: [],
    pilihan: [{ id: 'lms', sesi: 1 }, { id: 'guruOff', sesi: 2 }], nSiswa: 300, hSiswa: 240000,
    kelompokKelas: () => 1 },
  berkelompok: { ...dasar, asal: 'platform', pilihan: [{ id: 'guruOff', sesi: 2 }], nSiswa: 300, hSiswa: 0,
    kelompok: [{ nomor: 1, nama: ' ', hargaSiswa: 279000 }, { nomor: 3, nama: 'Kelas 12', hargaSiswa: 350000 }],
    nomorKelompok: [1, 3],
    komponenKelompok: [{ id: 'lms', sesi: 1, kelompok: 1 }, { id: 'tryout', sesi: 1, kelompok: 3 },
      { id: 'asesmen', sesi: 1, kelompok: 2 }, { id: 'guruOff', sesi: 2, kelompok: 1 }],
    kelompokKelas: (k) => (k === 12 ? 3 : 1) },
  unggahan: { ...dasar, awalId: undefined, adaAwal: false, pindaian: true, asal: 'unggahan', kelompok: null,
    komponenKelompok: [], nomorKelompok: [], pilihan: [{ id: 'lms', sesi: 1 }], nSiswa: 300, hSiswa: 100000,
    kelompokKelas: () => 1 },
};

const buat = process.env.BUAT_EMAS === '1';
for (const [nama, masukan] of Object.entries(KASUS)) {
  const hasil = JSON.stringify(susunIsiPo(masukan), null, 2) + '\n';
  const jalur = new URL(`./emas/isi-po-${nama}.json`, import.meta.url);
  if (buat) { writeFileSync(jalur, hasil); continue; }
  assert.equal(hasil, readFileSync(jalur, 'utf8'), `kiriman ${nama} berubah`);
  console.log(`  OK  kiriman ${nama} identik dengan rekaman`);
}
console.log(buat ? 'rekaman kiriman ditulis' : '\n3 pemeriksaan lolos.');
```

  Jalankan `BUAT_EMAS=1 node uji/isi-po.test.mjs`, lalu buka ketiga JSON dan periksa dengan
  mata: `berkelompok` tidak memuat komponen kelompok 2 (tidak ada di `nomorKelompok`), nama
  kelompok 1 kosong jadi tidak ada `nama`, `hargaSiswa` 0; `unggahan` tanpa `id`,
  `pindaianBaru` false; termin kosong dibuang.

- [ ] **Langkah 4:** `node uji/isi-po.test.mjs` → 3 OK. `npm run periksa` → semua lolos.
- [ ] **Langkah 5: Uji mutasi.** Hapus `|| undefined` dari `masaMulai` di `isi-po-form.ts`
  sementara, jalankan uji dengan `masaMulai: ''` di salah satu kasus → harus gagal; pulihkan.
- [ ] **Langkah 6: Commit**
  `git add -- lib/isi-po-form.ts "app/(sistem)/po/baru/form-po.tsx" uji/isi-po.test.mjs uji/emas/isi-po-*.json`
  `git commit -m "Wizard PO 1/6: penyusun kiriman form sebagai fungsi murni dan rekamannya"`

---

### Tugas 2: Daftar langkah dan halangan berlabel langkah

**Berkas:**
- Buat: `lib/langkah-po.ts`
- Ubah: `lib/kelengkapan-po.ts`, `lib/kelompok.ts`
- Uji: `uji/langkah-po.test.mjs`; `uji/kelengkapan-po.test.mjs` dan `uji/kelompok.test.mjs`
  harus tetap lolos tanpa diubah

**Antarmuka:**
- Menghasilkan: `KodeLangkah`, `Halangan`, `LANGKAH`, `langkahTampil(adaAwal)`,
  `langkahAwal(adaAwal)`, `statusLangkah(kode, halangan, dikunjungi)`, `halamanScan(kode)`;
  `kekuranganPo(d): Halangan[]` di `kelengkapan-po.ts`; bidang `masalahBerlangkah` pada
  hasil `hitungPerKelompok`.

- [ ] **Langkah 1: Tulis `lib/langkah-po.ts`**

```ts
/** Langkah wizard Form PO (catatan/11). Murni, dipakai klien. */
export type KodeLangkah = 'cara' | 'sekolah' | 'paket' | 'rombel' | 'termin' | 'penanda' | 'tinjau';
export type Halangan = { langkah: KodeLangkah; pesan: string };

export const LANGKAH: { kode: KodeLangkah; judul: string }[] = [
  { kode: 'cara', judul: 'Cara membuat' },
  { kode: 'sekolah', judul: 'Sekolah' },
  { kode: 'paket', judul: 'Paket & harga' },
  { kode: 'rombel', judul: 'Rombel' },
  { kode: 'termin', judul: 'Termin & masa aktif' },
  { kode: 'penanda', judul: 'Penanda tangan & catatan' },
  { kode: 'tinjau', judul: 'Tinjau' },
];

/** "Cara membuat" hanya saat membuat PO baru; jalur PO yang sudah ada dibekukan. */
export const langkahTampil = (adaAwal: boolean) => LANGKAH.filter((l) => !adaAwal || l.kode !== 'cara');

/** PO baru mulai dari awal; draf yang dibuka lagi langsung ke Tinjau. */
export const langkahAwal = (adaAwal: boolean): KodeLangkah => (adaAwal ? 'tinjau' : 'cara');

export type StatusLangkah = 'lengkap' | 'halangan' | 'belum';
export function statusLangkah(kode: KodeLangkah, halangan: Halangan[], dikunjungi: Set<KodeLangkah>): StatusLangkah {
  if (halangan.some((h) => h.langkah === kode)) return 'halangan';
  return dikunjungi.has(kode) ? 'lengkap' : 'belum';
}

/** Halaman scan PO unggahan yang ditampilkan di samping langkah; null = scan utuh. */
export function halamanScan(kode: KodeLangkah): number | null {
  if (kode === 'penanda') return 2;
  if (kode === 'tinjau' || kode === 'cara') return null;
  return 1;
}
```

- [ ] **Langkah 2: Tulis `uji/langkah-po.test.mjs`**

```js
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';
const L = muat('langkah-po');
let n = 0; const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.deepEqual(L.LANGKAH.map((l) => l.kode), ['cara', 'sekolah', 'paket', 'rombel', 'termin', 'penanda', 'tinjau']);
ok('urutan langkah sesuai keputusan 14 Sep 2026: paket sebelum rombel');
assert.equal(L.langkahTampil(true).some((l) => l.kode === 'cara'), false);
assert.equal(L.langkahTampil(false)[0].kode, 'cara');
ok('"Cara membuat" hanya untuk PO baru');
assert.equal(L.langkahAwal(true), 'tinjau'); assert.equal(L.langkahAwal(false), 'cara');
ok('PO baru mulai di awal, draf lama di Tinjau');
const h = [{ langkah: 'paket', pesan: 'x' }];
assert.equal(L.statusLangkah('paket', h, new Set()), 'halangan');
assert.equal(L.statusLangkah('sekolah', h, new Set(['sekolah'])), 'lengkap');
assert.equal(L.statusLangkah('termin', h, new Set()), 'belum');
ok('status: halangan mengalahkan dikunjungi; belum dibuka tetap belum');
assert.deepEqual(['sekolah', 'paket', 'rombel', 'termin', 'penanda', 'tinjau'].map(L.halamanScan), [1, 1, 1, 1, 2, null]);
ok('halaman scan per langkah');
console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 3: `lib/kelengkapan-po.ts`**: ganti badan `kurangLengkapPo` jadi daftar
  berlabel, dan jadikan fungsi lama pembungkusnya (uji lama tetap lolos tanpa diubah).

```ts
import type { Halangan } from './langkah-po';

export function kekuranganPo(d: IsianPo): Halangan[] {
  const terisi = d.termin.filter((t) => t.nominal > 0 || t.tanggal);
  const total = terisi.reduce((a, t) => a + (t.nominal || 0), 0);
  const di = (langkah: Halangan['langkah'], pesan: string): Halangan => ({ langkah, pesan });
  return [
    ...(kosong(d.sekolah.nama) ? [di('sekolah', 'Nama sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.npsn) ? [di('sekolah', 'NPSN belum diisi.')] : []),
    ...(kosong(d.sekolah.kepala_sekolah) ? [di('sekolah', 'Nama kepala sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.kepsek_hp) ? [di('sekolah', 'Nomor HP kepala sekolah belum diisi.')] : []),
    ...(kosong(d.sekolah.bendahara) ? [di('sekolah', 'Nama bendahara belum diisi.')] : []),
    ...(kosong(d.sekolah.bendahara_hp) ? [di('sekolah', 'Nomor HP bendahara belum diisi.')] : []),
    ...(kosong(d.sumberDana) ? [di('termin', 'Sumber dana belum dipilih.')] : []),
    ...(d.sumberDana === 'Lainnya' && kosong(d.sumberDanaLain)
      ? [di('termin', 'Sumber dana "Lainnya" belum dijelaskan.')] : []),
    ...(kosong(d.masaMulai) || kosong(d.masaSelesai) ? [di('termin', 'Masa aktif belum lengkap.')] : []),
    ...(!kosong(d.masaMulai) && !kosong(d.masaSelesai) && d.masaSelesai! <= d.masaMulai!
      ? [di('termin', 'Masa aktif berakhir sebelum atau pada tanggal mulainya.')] : []),
    ...(kosong(d.tanggalTtd) ? [di('penanda', 'Tanggal penandatanganan belum diisi.')] : []),
    ...(kosong(d.namaPm) ? [di('penanda', 'Partnership Manager belum dipilih.')] : []),
    ...(kosong(d.namaSm) ? [di('penanda', 'Sales Manager belum dipilih.')] : []),
    ...(d.jumlahSiswa < 1 ? [di('rombel', 'Jumlah siswa belum diisi.')] : []),
    ...(!terisi.length ? [di('termin', 'Termin pembayaran belum diisi.')] : []),
    ...(terisi.some((t) => kosong(t.tanggal) || !t.nominal)
      ? [di('termin', 'Ada termin yang tanggal atau nominalnya masih kosong.')] : []),
    ...(terisi.length && total !== d.grandTotal
      ? [di('termin', `Total termin ${rp(total)} belum sama dengan grand total ${rp(d.grandTotal)}.`)] : []),
  ];
}

export const kurangLengkapPo = (d: IsianPo): string[] => kekuranganPo(d).map((h) => h.pesan);
```

- [ ] **Langkah 4: `lib/kelompok.ts`**: tambahkan `masalahBerlangkah` di samping `masalah`
  (yang dibaca server tidak berubah). Setiap `masalah.push(x)` diganti `catat(langkah, x)`:

```ts
  const masalahBerlangkah: { langkah: 'paket' | 'rombel'; pesan: string }[] = [];
  const catat = (langkah: 'paket' | 'rombel', pesan: string) => { masalah.push(pesan); masalahBerlangkah.push({ langkah, pesan }); };
```

  Label: nomor ganda, nomor di luar 1–6, nama > 60, komponen menunjuk kelompok tak ada,
  "belum punya komponen" → `paket`; rombel ganda, siswa tak tertagih, "belum berisi siswa"
  → `rombel`. Tambahkan `masalahBerlangkah` ke tipe `HasilPerKelompok` dan ke objek hasil.
  Tambahkan satu pemeriksaan di `uji/kelompok.test.mjs` bagian 5:

```js
  const mb = hitungPerKelompok({ ...dasar, kelompok: [{ nomor: 1, hargaSiswa: 1 }], komponen: ke(['lms']),
    rombel: [rombel(10, 30, 1), rombel(11, 12, 2)] }).masalahBerlangkah;
  assert.deepEqual(mb.map((m) => m.langkah), ['rombel']);
```

- [ ] **Langkah 5:** `node uji/langkah-po.test.mjs && node uji/kelengkapan-po.test.mjs && node uji/kelompok.test.mjs`
  lalu `npm run periksa`. Semua lolos; `uji/emas` tetap cocok.
- [ ] **Langkah 6: Commit** berkas-berkas di atas: `"Wizard PO 2/6: daftar langkah dan halangan berlabel langkah"`.

---

### Tugas 3: State form pindah ke hook, tampilan belum berubah

**Berkas:**
- Buat: `app/(sistem)/po/baru/use-form-po.ts`, `app/(sistem)/po/baru/isian.tsx`
- Ubah: `app/(sistem)/po/baru/form-po.tsx`
- Uji: rekaman HTML pratinjau sebelum/sesudah

**Antarmuka:**
- Menghasilkan: `useFormPo(props: PropsFormPo)` mengembalikan seluruh state, setter,
  turunan (`h`, `hk`, `nSiswa`, `grand`, `rintangan`, `kurangLengkap`, `html`, `cocok`,
  `hampir`, `hematPaket`, `lantaiSiswa`, `lantaiGuru`, `hSiswa`, `hGuru`, `totalTermin`,
  `sisaUntuk`, `labelKelompok`, `kelompokKelas`, `komponenKelompok`, `pilihan`,
  `barisKelas`, `kolomRombel`, `totalRombel`, `berkelompok`) dan penangan (`simpan`,
  `pilihPindaian`, `pisah`, `tambahKelompok`, `hapusKelompok`, `ubahKelompok`), plus `kirim`,
  `pesan`, `pratinjau`, `pratinjauTersimpan`. Tipe `PropsFormPo` = props `FormPo` sekarang.
  `isian.tsx` mengekspor `InputAngka`, `bukaKalender`, `Isian` (pengganti fungsi `isian`),
  `pemilih`, `MAKS_TERMIN`, `labelTermin`.

- [ ] **Langkah 1: Rekam HTML sebelum.** Salin `uji/pratinjau-kelompok.tsx` ke
  `uji/pratinjau-wizard.tsx` (nama berkas keluaran `_wizard-*`, tambahkan pola ke
  `.gitignore`). Jalankan dan simpan `_wizard-satu-terang.html` dan
  `_wizard-banyak-terang.html` ke `/tmp` sebagai rekaman "sebelum".
- [ ] **Langkah 2: Pindahkan** `InputAngka` (`form-po.tsx:33-51`), `bukaKalender`
  (`54-57`), `MAKS_TERMIN`, `huruf`, `labelTermin` (`21-24`), fungsi `isian`
  (`489-496`, jadi komponen `Isian`), dan `pemilih` (`426-458`) ke `isian.tsx`, apa adanya.
- [ ] **Langkah 3: Pindahkan** seluruh isi komponen dari `form-po.tsx:73` sampai sebelum
  `return (` (baris 497) ke `useFormPo`, apa adanya, dan kembalikan semuanya dalam satu
  objek. `FormPo` memanggil `const f = useFormPo(props)` lalu JSX-nya memakai `f.x`.
- [ ] **Langkah 4:** Jalankan harness lagi; `diff` HTML sebelum/sesudah harus kosong.
  `npx tsc --noEmit` bersih, `npm run periksa` lolos.
- [ ] **Langkah 5: Commit**: `"Wizard PO 3/6: state form pindah ke hook, tampilan tidak berubah"`.

---

### Tugas 4: Halangan berlabel di hook

**Berkas:** Ubah `app/(sistem)/po/baru/use-form-po.ts`.

**Antarmuka:**
- Mengonsumsi: `Halangan`, `kekuranganPo`, `masalahBerlangkah` (Tugas 2).
- Menghasilkan: `halanganSimpan: Halangan[]`, `halanganCetak: Halangan[]`; `rintangan`
  dan `kurangLengkap` tetap ada sebagai `.map(h => h.pesan)` supaya tampilan lama sama.

- [ ] **Langkah 1:** Susun ulang `rintangan` jadi `halanganSimpan` dengan label:

| Sumber | Langkah |
|---|---|
| `hk.masalahBerlangkah` | labelnya sendiri |
| minimal/kapasitas per kelompok, lantai per kelompok, `halangan` (minimal/kapasitas satu kelompok), lantai siswa/guru, "Belum ada komponen", unggahan berkelompok | `paket` |
| total termin ≠ grand total | `termin` |
| nama sekolah | `sekolah` |
| pindaian belum dipilih | `cara` |
| pernyataan belum dicentang | `tinjau` |

  `halanganCetak` = `halanganSimpan` ditambah `kekuranganPo(...)` yang pesannya belum ada
  di `halanganSimpan`. Urutan pesan dalam `rintangan` dan `kurangLengkap` harus sama
  dengan sebelumnya.
- [ ] **Langkah 2:** Harness pratinjau: HTML tetap identik dengan rekaman Tugas 3.
  `npm run periksa` lolos.
- [ ] **Langkah 3: Commit**: `"Wizard PO 4/6: halangan simpan dan cetak berlabel langkah"`.

---

### Tugas 5: Kerangka wizard dan komponen per langkah

**Berkas:**
- Buat: `app/(sistem)/po/baru/langkah/{cara,sekolah,paket,rombel,termin,penanda,tinjau}.tsx`,
  `app/(sistem)/po/baru/ringkasan-harga.tsx`, `app/(sistem)/po/baru/penampil-scan.tsx`
- Ubah: `app/(sistem)/po/baru/form-po.tsx`, `app/globals.css`, `uji/pratinjau-wizard.tsx`

**Antarmuka:**
- Mengonsumsi: `useFormPo`, `LANGKAH`, `langkahTampil`, `langkahAwal`, `statusLangkah`,
  `halamanScan`, `halanganSimpan`, `halanganCetak`.
- Menghasilkan: props opsional `mulaiDi?: KodeLangkah` pada `FormPo` (hanya pratinjau).
  Setiap komponen langkah: `({ f, ke }: { f: ReturnType<typeof useFormPo>; ke: (k: KodeLangkah) => void })`;
  langkah yang tidak memakai `ke` tetap menerimanya supaya kerangka bisa memanggil semuanya seragam.

- [ ] **Langkah 1: Isi komponen langkah** dengan JSX yang ADA, dipindah:

| Komponen | Sumber di `form-po.tsx` |
|---|---|
| `cara.tsx` | 502-531 (Cara membuat PO) |
| `sekolah.tsx` | 675-705 (Data Sekolah, termasuk `fieldset` terkunci) |
| `paket.tsx` | 586-607 (Kelompok Siswa) + 609-673 (kartu kelompok, Pelatihan Guru, atau paket/fitur/add-on) + 748-762 (Harga Kesepakatan) |
| `rombel.tsx` | 707-746 (Jumlah Siswa per Rombel) |
| `termin.tsx` | 764-791 (Termin) + 796-803 (masa aktif, sumber dana, sumber dana lainnya) |
| `penanda.tsx` | 804-831 (kota, tanggal tanda tangan, PM, SM, dua catatan) |
| `tinjau.tsx` | 535-555 (Ganti pindaian) + 559-582 (pernyataan saja, tanpa iframe) + daftar `halanganSimpan`/`halanganCetak` berkelompok per langkah dengan tautan + tombol Cetak (934-957) + pratinjau dokumen (963-966) |
| `ringkasan-harga.tsx` | 836-932 (panel peserta, ringkasan kelompok, tier, petunjuk paket, peringatan lantai unggahan) |

- [ ] **Langkah 2: `penampil-scan.tsx`**: `iframe` dari `f.pratinjau ?? f.pratinjauTersimpan`
  dengan `#page=${halamanScan(langkah)}` bila tidak null; tampil hanya bila `asal ===
  'unggahan'` dan ada tautan. `key` iframe = tautan + halaman, supaya berpindah halaman.
- [ ] **Langkah 3: `form-po.tsx` jadi kerangka**:

```tsx
export default function FormPo(props: PropsFormPo & { mulaiDi?: KodeLangkah }) {
  const f = useFormPo(props);
  const daftar = langkahTampil(!!props.awal);
  const [kini, setKini] = useState<KodeLangkah>(props.mulaiDi ?? langkahAwal(!!props.awal));
  const [dikunjungi, setDikunjungi] = useState<Set<KodeLangkah>>(() => new Set([kini]));
  const ke = (k: KodeLangkah) => { setKini(k); setDikunjungi((s) => new Set(s).add(k)); };
  const i = daftar.findIndex((l) => l.kode === kini);
  const Isi = { cara: Cara, sekolah: Sekolah, paket: Paket, rombel: Rombel, termin: Termin,
    penanda: Penanda, tinjau: Tinjau }[kini];
  const denganScan = f.asal === 'unggahan' && kini !== 'cara' && kini !== 'tinjau';
  const denganRingkasan = ['paket', 'rombel', 'termin', 'penanda', 'tinjau'].includes(kini);
  return (
    <>
      <nav className="bilah-langkah no-print" aria-label="Langkah Form PO">
        <ol>
          {daftar.map((l, n) => (
            <li key={l.kode}>
              <button type="button" aria-current={l.kode === kini ? 'step' : undefined}
                data-status={statusLangkah(l.kode, f.halanganCetak, dikunjungi)} onClick={() => ke(l.kode)}>
                <span className="bilah-nomor">{n + 1}</span> {l.judul}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <div className={denganRingkasan ? 'grid-po' : undefined}>
        <div className={denganScan ? 'langkah-dengan-scan' : undefined}>
          {denganScan && <PenampilScan f={f} langkah={kini} />}
          <div><Isi f={f} ke={ke} /></div>
        </div>
        {denganRingkasan && <RingkasanHarga f={f} />}
      </div>
      <div className="langkah-kaki no-print">
        <button type="button" className="preset" disabled={i <= 0} onClick={() => ke(daftar[i - 1].kode)}>← Kembali</button>
        <SimpanDraf f={f} ke={ke} />
        <button type="button" className="preset" disabled={i >= daftar.length - 1} onClick={() => ke(daftar[i + 1].kode)}>Lanjut →</button>
      </div>
    </>
  );
}
```

  `SimpanDraf` (di `form-po.tsx`): tombol simpan yang sama dengan `form-po.tsx:938-941`;
  bila `f.halanganSimpan` tidak kosong, di bawahnya daftar pesan, tiap pesan tombol-tautan
  `ke(h.langkah)` bertuliskan judul langkahnya. Pesan hasil simpan (`f.pesan`) tampil di
  atas kaki. `Tinjau` menerima `ke` untuk tautan halangannya.
- [ ] **Langkah 4: CSS** di `app/globals.css`, di dekat `.grid-po`:

```css
/* Wizard Form PO (catatan/11). Bilah langkah menggulir sendiri di layar sempit. */
.bilah-langkah{margin:0 0 16px;overflow-x:auto}
.bilah-langkah ol{display:flex;gap:6px;list-style:none;margin:0;padding:0}
.bilah-langkah button{display:flex;align-items:center;gap:8px;white-space:nowrap;padding:8px 12px;
  border:1px solid var(--line);border-radius:var(--r);background:var(--surface);color:var(--ink);font:inherit;font-size:13.5px;cursor:pointer}
.bilah-langkah button[aria-current="step"]{border-color:var(--primary);color:var(--primary-ink);font-weight:600}
.bilah-langkah button[data-status="halangan"] .bilah-nomor{background:var(--danger-soft);color:var(--danger)}
.bilah-langkah button[data-status="lengkap"] .bilah-nomor{background:var(--primary-soft);color:var(--primary-ink)}
.bilah-nomor{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:999px;
  background:var(--surface-2);font-variant-numeric:tabular-nums;font-size:12px}
.langkah-dengan-scan{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px;align-items:start}
.langkah-dengan-scan iframe{width:100%;height:78vh;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.langkah-kaki{display:flex;gap:10px;justify-content:space-between;align-items:flex-start;margin:20px 0}
@media screen and (max-width:920px){.langkah-dengan-scan{grid-template-columns:1fr}.langkah-dengan-scan iframe{height:60vh}}
@media screen and (max-width:520px){.bilah-langkah button,.langkah-kaki button{min-height:44px}}
```

  Status langkah tidak boleh hanya warna: `data-status="halangan"` juga menambah teks
  tersembunyi-layar ", ada halangan" (`<span className="sr">`) di dalam tombolnya.
- [ ] **Langkah 4b: Ringkasan harga di ponsel.** Spesifikasi: bilah ringkas di bawah layar
  pada ponsel, bukan panel penuh di atas halaman. Di `ringkasan-harga.tsx` tambahkan satu
  baris `.ringkas-ponsel` (grand total + jumlah halangan simpan) yang hanya tampil di layar
  sempit, dan bungkus panel lengkapnya dalam `<details className="ringkas-rincian">` di
  layar sempit. CSS:

```css
.ringkas-ponsel{display:none}
@media screen and (max-width:920px){
  .ringkas-ponsel{display:flex;justify-content:space-between;gap:12px;position:sticky;bottom:0;
    padding:10px 16px;background:var(--surface);border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
}
```

  Aturan lama `.ledger{position:static;order:-1}` pada ≤920px diganti supaya panel lengkap
  tidak lagi naik ke atas isi langkah: `.ledger{position:static;order:0}`.

- [ ] **Langkah 5: Pratinjau.** `uji/pratinjau-wizard.tsx` merender `FormPo` untuk tiap
  `mulaiDi` × {satu kelompok, tiga kelompok, unggahan} ke `_wizard-<langkah>-<kasus>-<tema>.html`.
  Potret dengan `node uji/tangkap-layar.mjs` di 1200px, dan ulang di 375px (tambahkan
  argumen lebar ke `tangkap-layar.mjs` bila belum ada). Periksa dengan mata: tiap langkah
  hanya menampilkan bagiannya, tidak ada yang hilang dibanding form lama, kaki selalu ada.
- [ ] **Langkah 6:** `npm run periksa` (termasuk `tata-letak`, `batas-harga`,
  `isi-po`, `emas`), `npm run build`.
- [ ] **Langkah 7: Commit**: `"Wizard PO 5/6: kerangka wizard dan komponen per langkah"`.

---

### Tugas 6: Pernyataan batal saat isi berubah, penyaring antislop, rilis

**Berkas:** Ubah `app/(sistem)/po/baru/use-form-po.ts`; `catatan/11-spesifikasi-wizard-po.md`.

- [ ] **Langkah 1: Pernyataan batal otomatis.** Di `useFormPo`, simpan tanda isi saat
  dicentang dan batalkan bila tandanya berbeda:

```ts
  const tandaIsi = JSON.stringify({ ...isiSekarang, pindaianBaru: undefined });
  const tandaSaatDicentang = useRef<string | null>(null);
  useEffect(() => {
    if (sesuaiPindaian && tandaSaatDicentang.current === null) tandaSaatDicentang.current = tandaIsi;
    if (!sesuaiPindaian) tandaSaatDicentang.current = null;
    else if (tandaSaatDicentang.current !== tandaIsi) setSesuaiPindaian(false);
  }, [sesuaiPindaian, tandaIsi]);
```

  `isiSekarang` = `susunIsiPo(...)` dengan masukan yang sama seperti di `simpan()`
  (pindahkan pemanggilannya ke `useMemo` dan pakai di keduanya).
- [ ] **Langkah 2: Penyaring antislop.** Muat skill antislop (inti, ui, copywriting,
  human) dan periksa semua teks dan CSS baru: tanpa em dash di teks layar, kontras
  `.bilah-nomor` di kedua tema (pakai pemeriksa kontras skill), fokus keyboard terlihat
  pada tombol bilah, target 44px di 375px.
- [ ] **Langkah 3: Verifikasi.** `npm run periksa`, `npm run build`,
  `node uji/pindai-bundel.mjs`, `git diff 51e5650 -- uji/emas` hanya menambah
  `isi-po-*.json`.
- [ ] **Langkah 4: QA independen.** Brief: tinjau `git diff 51e5650..HEAD` terhadap
  `catatan/11`; kiriman identik; tidak ada bagian form lama yang hilang; navigasi; tema;
  375px; DILARANG membaca isi `.env*`. Perbaiki temuan, ulang QA sampai PASS.
- [ ] **Langkah 5: Deploy** (cadangkan `.env.local`, `vercel deploy --prod --yes`, cek
  `.env.local` utuh), rute produksi 200/307, pindai chunk publik.
- [ ] **Langkah 6: Catat** status "tayang" dan hasil QA di `catatan/11`, commit:
  `"Wizard PO 6/6: pernyataan batal saat isi berubah, QA, rilis"`.
