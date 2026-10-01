# Rencana Kerja: IoM Fase 1 (mesin aturan + gerbang keluar draf)

Status: **SELESAI dan TAYANG 17 Sep 2026.** Tugas 1 `747bdc4`, Tugas 2 `c6d953d`, Tugas 3
migrasi diterapkan ke produksi atas persetujuan Rizki, Tugas 4 `acd8b9c`, Tugas 5 QA
independen PASS lalu deploy produksi. Tindak lanjut MINOR tercatat di `catatan/13` Fase 1.

> **Untuk agen pelaksana:** WAJIB memakai superpowers:executing-plans (atau
> superpowers:subagent-driven-development) untuk menjalankan rencana ini tugas demi tugas.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** Aturan IoM `iom-2026-09-17b` berjalan di dua tempat: (A) basis data menolak PO
keluar draf yang melanggar syarat maju, dan (B) mesin aturan murni `lib/iom.ts` bisa
menilai sebuah PO untuk verifikasi otomatis. Mesin belum disambungkan ke alur apa pun;
penyambungannya Fase 2 dan 3 (`catatan/13`).

**Arsitektur:** Penjagaan sesungguhnya ada di basis data: satu trigger `po_syarat_maju`
menstempel `versi_iom` pada PO baru, menolak perubahan stempel, dan memeriksa syarat maju
pada transisi keluar draf (jalur platform `kirimUntukTtd` dan jalur unggahan
`ajukan_po_unggahan` memakai lompatan status yang sama, jadi satu trigger menutup
keduanya). Pesannya kalimat manusia dan sudah tampil lewat penanganan galat yang ada.
Mesin `lib/iom.ts` fungsi murni tanpa basis data, tanpa tanggal sistem, tanpa nilai
pricelist; harga acuan dioper pemanggil dari tabel `harga_komponen`/`harga_paket`.

**Teknologi:** Next.js 16 App Router, React 19, Supabase Postgres (plpgsql), uji `node --test`
dengan pemuat `uji/muat.mjs`.

**Spesifikasi:** `catatan/13a-aturan-iom.md` (aturan resmi `iom-2026-09-17b`, termasuk
Bagian 7) dan `catatan/13-rencana-verifikasi-otomatis.md` (arah Fase 1-5).

## Batasan global

- Acquisition Price tidak pernah ke basis data maupun peramban. `lib/iom.ts` hanya boleh
  `import type` dari `./pricelist`.
- Penjagaan di basis data; pesan aplikasi pelengkap, bukan pengganti.
- Basis data TIDAK punya lingkungan dev (`supabase/README.md`): migrasi dibuktikan dulu di
  produksi dalam transaksi yang dibatalkan (diakhiri `raise exception` yang membawa hasil),
  dengan simulasi peran `authenticated` untuk sisi boleh DAN dilarang. Menerapkan migrasi
  ke produksi hanya sesudah Rizki menyetujui secara eksplisit di obrolan.
- Salinan SQL setiap migrasi disimpan di `supabase/migrasi/`, komentar alasan ikut.
- Fail-closed: galat evaluasi berarti tidak lolos.
- Keputusan A (termin) untuk semua PO; keputusan B (masa aktif, lima isian sekolah) hanya
  PO berstempel `versi_iom`. PO tanpa stempel selalu manual di mesin.
- Nama trigger baru harus berurutan abjad SESUDAH `po_bekukan_sekolah` (trigger BEFORE
  berjalan menurut abjad), supaya `sekolah_beku` sudah disegarkan saat dibaca.
- Teks layar: tanpa tanda pisah panjang, dua tema, target sentuh ≥44px di ≤520px
  (`DESIGN.md`); saring dengan skill antislop.
- Commit dengan jalur eksplisit, tidak pernah `git add -A` (`.commandcode/` bukan milik proyek).
- QA independen sebelum deploy produksi, tanpa pengecualian; brief QA melarang membaca isi
  `.env*`. Cadangkan `.env.local` sebelum deploy; `git push` tidak men-deploy.

## Peta berkas

| Berkas | Tugas | Isi |
|---|---|---|
| `lib/iom.ts` (baru) | 1 | `VERSI_IOM`, tipe fakta, `nilai()`, `nilaiAman()` |
| `uji/iom.test.mjs` (baru) | 1 | uji murni setiap aturan, dua sisi |
| `supabase/migrasi/20260917_syarat_maju_iom.sql` (baru) | 2 | kolom, trigger, pembekuan |
| `uji/syarat-maju.test.mjs` (baru) | 2 | penjaga bentuk migrasi + kecocokan versi |
| `lib/po-aksi.ts`, `lib/isi-po-form.ts`, `lib/checklist.ts` | 4 | bendera `permintaanTambahan` |
| `app/(sistem)/po/baru/use-form-po.ts`, `langkah/penanda.tsx` | 4 | kotak centang wizard |
| `app/(sistem)/po/[id]/page.tsx` | 4 | memuat bendera ke `awal` |
| `uji/isi-po.test.mjs`, `uji/emas/isi-po-*.json` | 4 | rekaman kiriman diperbarui sengaja |
| `catatan/13`, `catatan/14` | 5 | status dan hasil QA |

Urutan wajib: Tugas 3 (kolom ada di produksi) SEBELUM Tugas 5 men-deploy aplikasi Tugas 4,
karena `simpanDraf` akan menulis `permintaan_tambahan`.

---

### Tugas 1: Mesin aturan murni `lib/iom.ts`

**Berkas:** Buat `lib/iom.ts`, `uji/iom.test.mjs`.

**Antarmuka yang dihasilkan (dipakai Fase 2):**

```ts
export const VERSI_IOM = 'iom-2026-09-17b';
export const BUTIR_DEKLARASI: readonly string[];
export type FaktaPo; export type HargaKomponen; export type HargaPaket; export type Deklarasi;
export type HasilAturan = { kode: string; lolos: boolean; bukti: string };
export type Verdict = { versiIom: string; lolos: boolean; paket: string | null; gagal: string[]; hasil: HasilAturan[] };
export function nilai(f: FaktaPo, komponen: HargaKomponen[], paket: HargaPaket[], deklarasi: Deklarasi[], hariIni: string): Verdict;
export function nilaiAman(...sama dengan nilai): Verdict;
```

- [ ] **Langkah 1: Tulis uji yang gagal** di `uji/iom.test.mjs`:

```js
// Mesin aturan IoM (catatan/13a, iom-2026-09-17b). Setiap aturan diuji dua sisi: PO yang
// memenuhi semuanya lolos, dan merusak satu hal menggagalkan PERSIS aturan itu.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { nilai, nilaiAman, VERSI_IOM, BUTIR_DEKLARASI } = muat('iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Angka rekaan: yang diuji aturannya, bukan harganya.
const KOMPONEN = [
  { id: 'lms', grup: 'core', untukGuru: false, perSesi: false, priceList: 100, bottom: 60 },
  { id: 'modul', grup: 'core', untukGuru: false, perSesi: false, priceList: 20, bottom: 10 },
  { id: 'live', grup: 'core', untukGuru: false, perSesi: false, priceList: 30, bottom: 20 },
  { id: 'psiOff', grup: 'addon', untukGuru: false, perSesi: true, priceList: 50, bottom: 40 },
  { id: 'guruOff', grup: 'addon', untukGuru: true, perSesi: true, priceList: 70, bottom: 50 },
];
const PAKET = [
  { nama: 'Paket Uji', ids: ['lms', 'modul'], priceList: 110, bottom: 65 },
  { nama: 'Paket Live', ids: ['lms', 'live'], priceList: 120, bottom: 70 },
];
const DEKLARASI = [
  { produk: 'Paket Uji', butir: [...BUTIR_DEKLARASI], berlakuSampai: '2027-03-17' },
  { produk: 'Paket Live', butir: [...BUTIR_DEKLARASI], berlakuSampai: '2027-03-17' },
];
const HARI = '2026-09-17';

const lolos = () => ({
  versiIom: VERSI_IOM, asal: 'platform',
  sekolah: { nama: 'SMA Uji', npsn: '12345678', kepala_sekolah: 'Kepala Uji', kepsek_hp: '0800',
    bendahara: 'Bendahara Uji', bendahara_hp: '0801' },
  komponen: [{ id: 'lms', sesi: 1 }, { id: 'modul', sesi: 1 }],
  jumlahKelompok: 0, jumlahSiswa: 100, jumlahGuru: 0,
  hargaSiswa: 110, hargaGuru: 0, grandTotal: 11000,
  masaMulai: '2026-10-01', masaSelesai: '2027-09-30',
  termin: [{ nominal: 5000 }, { nominal: 6000 }],
  berkasUnggahan: null, ditinjauPada: null,
  adaPengecualianHoo: false, adaSponsorship: false, permintaanTambahan: false,
});
const nilaiDari = (f, dek = DEKLARASI) => nilai(f, KOMPONEN, PAKET, dek, HARI);

const v = nilaiDari(lolos());
assert.equal(v.lolos, true, JSON.stringify(v.gagal));
assert.equal(v.paket, 'Paket Uji');
assert.equal(v.versiIom, VERSI_IOM);
ok('PO yang memenuhi semua aturan lolos, paketnya dikenali');

// Setiap baris: merusak satu hal harus menggagalkan aturan yang disebut.
const kasus = [
  ['po-berstempel-iom', (f) => { f.versiIom = null; }],
  ['sekolah-terisi', (f) => { f.sekolah.nama = '  '; }],
  ['komponen-dikenal', (f) => { f.komponen.push({ id: 'hantu', sesi: 1 }); }],
  ['jumlah-siswa-minimal', (f) => { f.jumlahSiswa = 0; f.grandTotal = 0; f.termin = [{ nominal: 0 }]; }],
  ['minimal-peserta', (f) => { f.komponen = [{ id: 'lms', sesi: 1 }, { id: 'live', sesi: 1 }];
    f.jumlahSiswa = 10; f.hargaSiswa = 120; f.grandTotal = 1200; f.termin = [{ nominal: 1200 }]; }],
  ['kapasitas-sesi', (f) => { f.komponen.push({ id: 'psiOff', sesi: 1 }); }],
  ['termin-sama-total', (f) => { f.termin = []; }],
  ['termin-sama-total', (f) => { f.termin = [{ nominal: 1 }]; }],
  ['unggahan-ditinjau', (f) => { f.asal = 'unggahan'; f.berkasUnggahan = 'x/po.pdf'; }],
  ['masa-aktif-lengkap', (f) => { f.masaSelesai = null; }],
  ['masa-aktif-wajar', (f) => { f.masaSelesai = f.masaMulai; }],
  ['sekolah-lengkap', (f) => { f.sekolah.bendahara_hp = ''; }],
  ['satu-kelompok', (f) => { f.jumlahKelompok = 2; }],
  ['paket-persis', (f) => { f.komponen.push({ id: 'guruOff', sesi: 1 }); f.jumlahGuru = 10; }],
  ['layanan-sesuai-paket', (f) => { f.komponen = [{ id: 'lms', sesi: 1 }]; }],
  ['tanpa-diskon', (f) => { f.hargaSiswa = 109; f.grandTotal = 10900; f.termin = [{ nominal: 10900 }]; }],
  ['lantai-siswa', (f) => { f.hargaSiswa = 64; f.grandTotal = 6400; f.termin = [{ nominal: 6400 }]; }],
  ['tanpa-pengecualian-hoo', (f) => { f.adaPengecualianHoo = true; }],
  ['tanpa-sponsorship', (f) => { f.adaSponsorship = true; }],
  ['tanpa-permintaan-tambahan', (f) => { f.permintaanTambahan = true; }],
];
for (const [kode, rusak] of kasus) {
  const f = lolos();
  rusak(f);
  const h = nilaiDari(f);
  assert.equal(h.lolos, false, `${kode}: masih lolos`);
  assert.ok(h.gagal.includes(kode), `${kode}: tidak ada di gagal ${JSON.stringify(h.gagal)}`);
}
ok(`${kasus.length} perusakan: masing-masing menggagalkan aturannya sendiri`);

// Deklarasi: tidak ada, kedaluwarsa, butir kurang. Hari terakhir masih berlaku.
assert.ok(nilaiDari(lolos(), []).gagal.includes('deklarasi-berlaku'));
assert.ok(nilaiDari(lolos(), [{ ...DEKLARASI[0], berlakuSampai: '2026-09-16' }]).gagal.includes('deklarasi-berlaku'));
assert.ok(nilaiDari(lolos(), [{ ...DEKLARASI[0], butir: BUTIR_DEKLARASI.slice(1) }]).gagal.includes('deklarasi-berlaku'));
assert.equal(nilaiDari(lolos(), [{ ...DEKLARASI[0], berlakuSampai: HARI }]).lolos, true);
ok('deklarasi wajib ada, lengkap sepuluh butir, dan belum lewat berlakuSampai');

assert.deepEqual([...BUTIR_DEKLARASI], ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c2', 'd3', 'e3', 'e4']);
ok('sepuluh butir deklarasi sesuai 13a Bagian 3');

const rusak = lolos(); rusak.komponen = null;
const aman = nilaiAman(rusak, KOMPONEN, PAKET, DEKLARASI, HARI);
assert.equal(aman.lolos, false);
assert.deepEqual(aman.gagal, ['galat-evaluasi']);
ok('galat evaluasi berarti tidak lolos (fail-closed)');

const sumber = readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8');
assert.ok(!/import\s+(?!type\b)[^;]*from\s+'\.\/pricelist'/.test(sumber),
  'lib/iom.ts mengimpor NILAI dari pricelist: harga Acquisition bisa ikut terbawa');
ok('lib/iom.ts hanya mengimpor tipe dari pricelist');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal.** `node --test uji/iom.test.mjs`
  Harapan: GAGAL, `ENOENT ... lib/iom.ts`.

- [ ] **Langkah 3: Tulis `lib/iom.ts`:**

```ts
/**
 * Mesin aturan IoM (catatan/13a, versi di VERSI_IOM). Murni: tanpa basis data, tanpa
 * tanggal sistem, tanpa nilai pricelist. Pemanggil (Fase 2) membaca fakta PO dan harga
 * acuan dari basis data lalu mengopernya; tabel harga_komponen/harga_paket memang tidak
 * pernah memuat Acquisition, jadi modul ini aman dimuat di mana pun.
 *
 * Mesin ini TIDAK menggantikan penjagaan basis data: syarat maju (termin, masa aktif,
 * data sekolah) ditegakkan trigger po_syarat_maju. Di sini aturan yang sama dinilai ulang
 * supaya verdict mencatat buktinya sendiri, ditambah kelas PO (13a Bagian 4 dan 7).
 */
import type { Komponen } from './pricelist';
import { ID_GURU } from './aturan-komponen';
import { langgarMinimum, langgarKapasitas } from './hitung';

/** Sama dengan private.versi_iom_berlaku() di basis data; dijaga uji/syarat-maju.test.mjs. */
export const VERSI_IOM = 'iom-2026-09-17b';

/** Butir penilaian yang wajib dideklarasikan per paket (13a Bagian 3). */
export const BUTIR_DEKLARASI = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c2', 'd3', 'e3', 'e4'] as const;

type Teks = string | null | undefined;

export type FaktaPo = {
  /** Stempel saat PO dibuat; null = PO lama, selalu manual. */
  versiIom: string | null;
  asal: 'platform' | 'unggahan';
  /** Dari po.sekolah_beku. */
  sekolah: { nama?: Teks; npsn?: Teks; kepala_sekolah?: Teks; kepsek_hp?: Teks; bendahara?: Teks; bendahara_hp?: Teks };
  komponen: { id: string; sesi: number }[];
  /** Jumlah baris po_kelompok; 2 atau lebih = PO berkelompok. */
  jumlahKelompok: number;
  jumlahSiswa: number; jumlahGuru: number;
  hargaSiswa: number; hargaGuru: number; grandTotal: number;
  masaMulai: string | null; masaSelesai: string | null;
  termin: { nominal: number }[];
  berkasUnggahan: string | null; ditinjauPada: string | null;
  adaPengecualianHoo: boolean;
  /** Ada po_catatan jenis 'sponsorship' yang berisi. */
  adaSponsorship: boolean;
  permintaanTambahan: boolean;
};

export type HargaKomponen = { id: string; grup: string; untukGuru: boolean; perSesi: boolean; priceList: number; bottom: number };
export type HargaPaket = { nama: string; ids: string[]; priceList: number; bottom: number };
export type Deklarasi = { produk: string; butir: string[]; berlakuSampai: string };
export type HasilAturan = { kode: string; lolos: boolean; bukti: string };
export type Verdict = { versiIom: string; lolos: boolean; paket: string | null; gagal: string[]; hasil: HasilAturan[] };

const kosong = (s: Teks) => !s?.trim();
const himpunanSama = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',');
const ISIAN_SEKOLAH = ['npsn', 'kepala_sekolah', 'kepsek_hp', 'bendahara', 'bendahara_hp'] as const;

/** hariIni: 'YYYY-MM-DD' dari pemanggil, supaya fungsi ini tetap murni dan bisa diuji. */
export function nilai(
  f: FaktaPo, komponen: HargaKomponen[], paket: HargaPaket[], deklarasi: Deklarasi[], hariIni: string,
): Verdict {
  const hasil: HasilAturan[] = [];
  const cek = (kode: string, lolos: boolean, bukti: string) => { hasil.push({ kode, lolos, bukti }); };

  // ---- Bagian 1 dan 2 (syarat maju dan kelengkapan) ----
  cek('po-berstempel-iom', f.versiIom !== null,
    f.versiIom ? `dibuat di bawah ${f.versiIom}` : 'PO dibuat sebelum IoM berlaku');
  cek('sekolah-terisi', !kosong(f.sekolah.nama), f.sekolah.nama?.trim() || 'nama sekolah kosong');

  const dikenal = new Set(komponen.map((k) => k.id));
  const asing = f.komponen.filter((k) => !dikenal.has(k.id)).map((k) => k.id);
  cek('komponen-dikenal', f.komponen.length > 0 && asing.length === 0,
    asing.length ? `tidak dikenal: ${asing.join(', ')}` : f.komponen.length ? 'semua dikenal' : 'tanpa komponen');
  cek('jumlah-siswa-minimal', f.jumlahSiswa >= 1, `${f.jumlahSiswa} siswa`);

  // hitung.ts butuh bentuk Komponen; `p` hanya dua tier, Acquisition memang tidak ada.
  const daftar = komponen.map((k): Komponen => ({
    id: k.id, s: k.id, n: k.id, g: k.grup === 'addon' ? 'addon' : 'core', p: [k.priceList, k.bottom] }));
  const minimal = langgarMinimum(f.komponen, f.jumlahSiswa, f.jumlahGuru, daftar);
  cek('minimal-peserta', minimal.length === 0, minimal.map((p) => p.pesan).join(' ') || 'terpenuhi');
  const kapasitas = langgarKapasitas(f.komponen, f.jumlahSiswa, f.jumlahGuru, daftar);
  cek('kapasitas-sesi', kapasitas.length === 0, kapasitas.map((p) => p.pesan).join(' ') || 'terpenuhi');

  const totalTermin = f.termin.reduce((a, t) => a + (t.nominal || 0), 0);
  cek('termin-sama-total', f.termin.length > 0 && totalTermin === f.grandTotal,
    f.termin.length ? `total termin ${totalTermin}, grand total ${f.grandTotal}` : 'tanpa termin');
  if (f.asal === 'unggahan')
    cek('unggahan-ditinjau', !!f.berkasUnggahan && !!f.ditinjauPada,
      !f.berkasUnggahan ? 'pindaian belum ada' : f.ditinjauPada ? `ditinjau ${f.ditinjauPada}` : 'belum ada pernyataan sesuai pindaian');

  cek('masa-aktif-lengkap', !!f.masaMulai && !!f.masaSelesai, `${f.masaMulai ?? '-'} s.d. ${f.masaSelesai ?? '-'}`);
  cek('masa-aktif-wajar', !!f.masaMulai && !!f.masaSelesai && f.masaSelesai > f.masaMulai,
    `${f.masaMulai ?? '-'} s.d. ${f.masaSelesai ?? '-'}`);
  const kurang = ISIAN_SEKOLAH.filter((k) => kosong(f.sekolah[k]));
  cek('sekolah-lengkap', kurang.length === 0, kurang.length ? `kosong: ${kurang.join(', ')}` : 'lengkap');

  // ---- Bagian 4 dan 7 (kelas PO yang boleh otomatis) ----
  cek('satu-kelompok', f.jumlahKelompok < 2, `${f.jumlahKelompok} baris kelompok`);
  const cocok = paket.find((p) => himpunanSama(p.ids, f.komponen.map((k) => k.id))) ?? null;
  const buktiPaket = cocok ? cocok.nama : 'susunan komponen bukan paket persis (a la carte, add-on, atau pelatihan guru)';
  cek('paket-persis', !!cocok, buktiPaket);
  // e1 (Bagian 7 butir 1): layanan sesuai PO bila susunannya persis paket yang dideklarasikan.
  cek('layanan-sesuai-paket', !!cocok, buktiPaket);

  const d = cocok ? deklarasi.find((x) => x.produk === cocok.nama) : undefined;
  const butirKurang = BUTIR_DEKLARASI.filter((b) => !d?.butir.includes(b));
  cek('deklarasi-berlaku', !!d && d.berlakuSampai >= hariIni && butirKurang.length === 0,
    !d ? 'tidak ada deklarasi untuk paket ini'
      : d.berlakuSampai < hariIni ? `kedaluwarsa ${d.berlakuSampai}`
      : butirKurang.length ? `butir belum dideklarasikan: ${butirKurang.join(', ')}` : `berlaku sampai ${d.berlakuSampai}`);
  cek('lantai-siswa', !!cocok && f.hargaSiswa >= cocok.bottom,
    cocok ? `harga ${f.hargaSiswa}, bottom ${cocok.bottom}` : 'tidak dinilai tanpa paket persis');
  // Pelatihan guru selalu membuat susunan bukan paket persis, jadi jalur otomatis tidak punya harga guru.
  const adaGuru = f.komponen.some((k) => ID_GURU.includes(k.id));
  cek('lantai-guru', !adaGuru, adaGuru ? 'ada pelatihan guru: dinilai manual' : 'tanpa pelatihan guru');
  cek('tanpa-diskon', !!cocok && f.hargaSiswa >= cocok.priceList,
    cocok ? `harga ${f.hargaSiswa}, price list ${cocok.priceList}` : 'tidak dinilai tanpa paket persis');
  cek('tanpa-pengecualian-hoo', !f.adaPengecualianHoo, f.adaPengecualianHoo ? 'ada pengecualian HoO' : 'tidak ada');
  cek('tanpa-sponsorship', !f.adaSponsorship, f.adaSponsorship ? 'ada catatan sponsorship' : 'tidak ada');
  cek('tanpa-permintaan-tambahan', !f.permintaanTambahan, f.permintaanTambahan ? 'Sales mencentang permintaan tambahan' : 'tidak ada');

  const gagal = hasil.filter((h) => !h.lolos).map((h) => h.kode);
  return { versiIom: VERSI_IOM, lolos: gagal.length === 0, paket: cocok?.nama ?? null, gagal, hasil };
}

/** Galat apa pun berarti tidak lolos: salah lolos jauh lebih mahal daripada salah manual. */
export function nilaiAman(...args: Parameters<typeof nilai>): Verdict {
  try {
    return nilai(...args);
  } catch (e) {
    return { versiIom: VERSI_IOM, lolos: false, paket: null, gagal: ['galat-evaluasi'],
      hasil: [{ kode: 'galat-evaluasi', lolos: false, bukti: String(e) }] };
  }
}
```

- [ ] **Langkah 4: Jalankan, pastikan lolos.** `node --test uji/iom.test.mjs` lalu `npm run periksa`.
  Harapan: lolos semua; `uji/batas-harga.test.mjs` tetap lolos.
- [ ] **Langkah 5: Uji mutasi.** Satu per satu, lalu kembalikan: (a) hapus `&& totalTermin === f.grandTotal`;
  (b) ganti `d.berlakuSampai >= hariIni` jadi `>`; (c) hapus `try`/`catch` di `nilaiAman`;
  (d) ubah impor jadi `import { KOMPONEN } from './pricelist'`. Masing-masing HARUS membuat
  `uji/iom.test.mjs` gagal; catat hasilnya di pesan commit.
- [ ] **Langkah 6: Commit.**

```bash
git add lib/iom.ts uji/iom.test.mjs
git commit -m "IoM Fase 1 1/5: mesin aturan murni lib/iom.ts"
```

---

### Tugas 2: Migrasi syarat maju, dibuktikan tanpa diterapkan

**Berkas:** Buat `supabase/migrasi/20260917_syarat_maju_iom.sql`, `uji/syarat-maju.test.mjs`.

- [ ] **Langkah 1: Baca ulang definisi hidup** (hanya baca) supaya salinan `bekukan_isi_po`
  memakai isi terbaru, dan pola hak akses mengikuti migrasi terakhir:

```sql
select pg_get_functiondef('private.bekukan_isi_po'::regproc);
select string_agg(tgname, ', ' order by tgname) from pg_trigger
 where tgrelid = 'public.po'::regclass and not tgisinternal;
```

  Harapan: isi sama dengan yang dikutip di Langkah 2 (tanpa `versi_iom`/`permintaan_tambahan`),
  trigger: `jaga_lantai_po, po_bekukan_isi, po_bekukan_sekolah, po_bekukan_sekolah_basi,
  po_catat, po_jaga_penutupan, po_sentuh, po_tinjauan_sidik`. Bila berbeda, BERHENTI dan
  laporkan.

- [ ] **Langkah 2: Tulis migrasi** `supabase/migrasi/20260917_syarat_maju_iom.sql`:

```sql
-- IoM iom-2026-09-17b (catatan/13a), Fase 1 bagian basis data. Rencana: catatan/14 Tugas 2.
--
-- Lubang yang ditutup (13a Bagian 1 dan 2): transisi keluar draf tidak punya gerbang.
-- PO tanpa satu termin pun lolos sampai tanda tangan, dan masa aktif maupun data sekolah
-- hanya syarat CETAK. Syaratnya dipasang di transisi keluar draf, bukan saat simpan:
-- draf boleh setengah jadi (lib/kelengkapan-po.ts).
--
-- Satu trigger menutup dua jalur: kirimUntukTtd (draf -> menunggu_ttd) dan
-- ajukan_po_unggahan (draf -> ditandatangani) sama-sama melompatkan status lewat UPDATE,
-- dan galat di trigger membatalkan seluruh RPC termasuk tanda tangannya.

-- 1. Versi yang berlaku, SATU tempat. Naik versi = ganti fungsi ini dan VERSI_IOM di
--    lib/iom.ts; uji/syarat-maju.test.mjs gagal bila keduanya berbeda.
create or replace function private.versi_iom_berlaku()
returns text language sql immutable set search_path = public
as $$ select 'iom-2026-09-17b'::text $$;

-- 2. Kolom. versi_iom TANPA default: PO yang sudah ada tetap null = PO lama (keputusan B,
--    tidak surut). Stempel PO baru diisi trigger, bukan default, supaya kiriman klien
--    tidak bisa memilih versinya sendiri.
alter table po add column if not exists versi_iom text;
-- b4 (13a Bagian 7 butir 2): Sales menyatakan ada permintaan di luar paket.
alter table po add column if not exists permintaan_tambahan boolean not null default false;

-- 3. Stempel, kekekalan stempel, dan syarat maju.
create or replace function private.jaga_syarat_maju()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_kurang text[] := '{}';
  v_n int;
  v_total bigint;
  r record;
begin
  if tg_op = 'INSERT' then
    new.versi_iom := private.versi_iom_berlaku();
    return new;
  end if;

  -- Tanpa ini Sales bisa mengosongkan stempel lewat PostgREST dan PO-nya lolos dari
  -- syarat B sebagai "PO lama".
  if new.versi_iom is distinct from old.versi_iom then
    raise exception 'Versi IoM sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
  end if;

  -- Hanya transisi KELUAR draf, kondisi yang sama persis dengan jaga_lantai_po.
  if old.status not in ('draf', 'ditolak') or new.status in ('draf', 'ditolak') then
    return new;
  end if;

  -- Keputusan A: berlaku untuk SEMUA PO, berstempel atau tidak.
  select count(*), coalesce(sum(nominal), 0) into v_n, v_total from po_termin where po_id = new.id;
  if v_n = 0 then
    v_kurang := array_append(v_kurang, 'Termin pembayaran belum diisi.');
  elsif v_total <> new.grand_total then
    v_kurang := array_append(v_kurang, format('Total termin Rp%s belum sama dengan grand total Rp%s.',
      replace(to_char(v_total, 'FM999,999,999,990'), ',', '.'),
      replace(to_char(new.grand_total, 'FM999,999,999,990'), ',', '.')));
  end if;

  -- Keputusan B: hanya PO berstempel. sekolah_beku sudah disegarkan po_bekukan_sekolah,
  -- yang berjalan lebih dulu (nama trigger ini sesudahnya menurut abjad).
  if new.versi_iom is not null then
    if new.masa_mulai is null or new.masa_selesai is null then
      v_kurang := array_append(v_kurang, 'Masa aktif belum lengkap.');
    elsif new.masa_selesai <= new.masa_mulai then
      v_kurang := array_append(v_kurang, 'Masa aktif berakhir sebelum atau pada tanggal mulainya.');
    end if;
    for r in select * from (values
        ('npsn', 'NPSN'), ('kepala_sekolah', 'Nama kepala sekolah'), ('kepsek_hp', 'Nomor HP kepala sekolah'),
        ('bendahara', 'Nama bendahara'), ('bendahara_hp', 'Nomor HP bendahara')) as t(kunci, label)
    loop
      if coalesce(btrim(new.sekolah_beku ->> r.kunci), '') = '' then
        v_kurang := array_append(v_kurang, r.label || ' belum diisi.');
      end if;
    end loop;
  end if;

  if cardinality(v_kurang) > 0 then
    raise exception 'PO belum bisa dikirim: %', array_to_string(v_kurang, ' ')
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists po_syarat_maju on po;
create trigger po_syarat_maju before insert or update on po
  for each row execute function private.jaga_syarat_maju();

-- 4. Bendera permintaan tambahan dibekukan bersama isi PO lainnya. Isi fungsi disalin dari
--    definisi hidup 17 Sep 2026; yang ditambahkan hanya permintaan_tambahan dan versi_iom.
create or replace function private.bekukan_isi_po()
returns trigger language plpgsql set search_path = public
as $$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $$;
```

- [ ] **Langkah 3: Tulis penjaga bentuk** `uji/syarat-maju.test.mjs`:

```js
// Syarat maju IoM, dibaca dari berkas migrasinya sendiri. Perilakunya dibuktikan langsung
// di basis data dalam transaksi yang dibatalkan (catatan/14 Tugas 2); uji ini menangkap
// saat seseorang kelak "merapikan" migrasinya dan diam-diam membuka pintu yang ditutup.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const sql = readFileSync(new URL('../supabase/migrasi/20260917_syarat_maju_iom.sql', import.meta.url), 'utf8');
const { VERSI_IOM } = muat('iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };
const badan = sql.slice(sql.indexOf('function private.jaga_syarat_maju'), sql.indexOf('create trigger po_syarat_maju'));

assert.match(sql, new RegExp(`select '${VERSI_IOM}'::text`));
ok('versi di basis data sama dengan VERSI_IOM di lib/iom.ts');

assert.ok('po_syarat_maju' > 'po_bekukan_sekolah');
assert.match(sql, /create trigger po_syarat_maju before insert or update on po/);
ok('trigger berjalan sesudah po_bekukan_sekolah, pada insert dan update');

assert.match(badan, /new\.versi_iom := private\.versi_iom_berlaku\(\)/);
assert.match(badan, /new\.versi_iom is distinct from old\.versi_iom/);
assert.match(sql, /add column if not exists versi_iom text;/);
ok('stempel diisi trigger, tanpa default kolom, dan tidak bisa diubah');

assert.match(badan, /old\.status not in \('draf', 'ditolak'\) or new\.status in \('draf', 'ditolak'\)/);
ok('syarat hanya pada transisi keluar draf');

const iB = badan.indexOf('if new.versi_iom is not null');
assert.ok(iB > 0 && badan.indexOf('if v_n = 0') > 0 && badan.indexOf('if v_n = 0') < iB);
ok('syarat termin berlaku untuk semua PO, sebelum cabang PO berstempel');

for (const k of ['new.masa_mulai is null', 'new.masa_selesai <= new.masa_mulai', "('npsn'",
  "('kepala_sekolah'", "('kepsek_hp'", "('bendahara'", "('bendahara_hp'"])
  assert.ok(badan.indexOf(k) > iB, `${k} tidak di cabang berstempel`);
ok('masa aktif dan kelima isian sekolah hanya untuk PO berstempel');

const beku = sql.slice(sql.indexOf('function private.bekukan_isi_po'));
assert.match(beku, /NEW\.permintaan_tambahan, NEW\.versi_iom\)/);
assert.match(beku, /OLD\.permintaan_tambahan, OLD\.versi_iom\)/);
ok('permintaan_tambahan dan versi_iom ikut dibekukan');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 4:** `node --test uji/syarat-maju.test.mjs` dan `npm run periksa`. Harapan: lolos.

- [ ] **Langkah 5: Bukti di produksi, DIBATALKAN.** Satu panggilan `execute_sql` berisi seluruh isi
  migrasi (Langkah 2), lalu blok di bawah. Blok diakhiri `raise exception` yang membawa hasil,
  jadi DDL dan data uji ikut batal. Sebelum trigger dibuat, satu PO "lama" disisipkan tanpa
  stempel. Susunan untuk disisipkan ke dalam berkas bukti (tidak disimpan di repo):

```sql
-- (a) sebelum membuat trigger: sisipkan PO lama tanpa stempel, sebagai postgres
-- (b) seluruh isi migrasi
-- (c) blok uji sebagai authenticated:
do $$
declare
  v_email text; v_sek uuid; v_po uuid; v_lama uuid; v_hasil jsonb := '[]'; v_pesan text;
begin
  select email into v_email from pengguna where 'admin_utama' = any(peran) and aktif limit 1;
  perform set_config('request.jwt.claims', json_build_object('email', v_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  -- Setiap kasus: siapkan PO, coba ubah status, catat berhasil/ditolak dan pesannya ke v_hasil.
  -- Kasus wajib (harapan dalam kurung):
  --  1 PO berstempel lengkap -> menunggu_ttd (BERHASIL)
  --  2 sisip PO dengan versi_iom 'palsu' -> tersimpan versi_iom_berlaku() (DITIMPA)
  --  3 update versi_iom jadi null pada draf (DITOLAK, 'Versi IoM')
  --  4 berstempel tanpa termin (DITOLAK, 'Termin pembayaran belum diisi.')
  --  5 berstempel total termin != grand total (DITOLAK, 'belum sama dengan grand total')
  --  6 berstempel masa_selesai null (DITOLAK, 'Masa aktif belum lengkap.')
  --  7 berstempel masa terbalik (DITOLAK, 'berakhir sebelum')
  --  8 berstempel bendahara_hp kosong (DITOLAK, 'Nomor HP bendahara belum diisi.')
  --  9 PO lama (tanpa stempel) masa null, termin benar -> menunggu_ttd (BERHASIL)
  -- 10 PO lama tanpa termin (DITOLAK, 'Termin pembayaran belum diisi.')
  -- 11 PO status menunggu_ttd, update permintaan_tambahan (DITOLAK, 'tidak bisa diubah isinya')
  -- 12 PO unggahan berstempel, berkas + pernyataan ada, bendahara kosong, lewat
  --    ajukan_po_unggahan (DITOLAK, 'Nomor HP bendahara'; tidak ada baris tanda_tangan tersisa)
  -- 13 PO berstempel ditolak -> menunggu_ttd dengan termin kosong (DITOLAK)
  raise exception 'HASIL_UJI %', v_hasil;
end $$;
```

  Pelaksana menulis setiap kasus sebagai sub-blok `begin ... exception when others then ... end`
  yang menyisipkan `sekolah`, `po`, `po_termin` persis seperti `simpanDraf` (`lib/po-aksi.ts`
  baris 388-460: sekolah dulu, PO dengan `dibuat_oleh` = email, lalu tabel anak), dan
  membandingkan hasil dengan harapan di atas. Harapan: pesan galat terakhir `HASIL_UJI` memuat
  13 kasus, semuanya sesuai harapan. Bila ada yang meleset, perbaiki migrasi (Langkah 2),
  ulangi Langkah 3-5.

- [ ] **Langkah 6: Mutasi di basis data** (dibatalkan juga): ulangi Langkah 5 dengan migrasi yang
  (a) tanpa cabang `elsif v_total <> new.grand_total`, lalu (b) dengan `if new.versi_iom is not null`
  diganti `if false`. Harapan: (a) kasus 5 berubah BERHASIL, (b) kasus 6-8 dan 12 berubah BERHASIL.
  Itu bukti kasusnya benar-benar menjaga.

- [ ] **Langkah 7: Commit** (migrasi BELUM diterapkan):

```bash
git add supabase/migrasi/20260917_syarat_maju_iom.sql uji/syarat-maju.test.mjs
git commit -m "IoM Fase 1 2/5: migrasi syarat maju, dibuktikan dalam transaksi dibatalkan"
```

---

### Tugas 3: Terapkan migrasi ke produksi (GERBANG PERSETUJUAN)

- [ ] **Langkah 1: Minta persetujuan Rizki di obrolan**, dengan ringkasan: kolom baru, trigger
  baru, `bekukan_isi_po` diganti, hasil 13 kasus dan mutasi. Jangan lanjut tanpa "ya" eksplisit.
- [ ] **Langkah 2:** `apply_migration` nama `20260917_syarat_maju_iom`, isi persis berkas Tugas 2.
- [ ] **Langkah 3: Bukti ulang sesudah diterapkan** (dibatalkan): blok kasus Tugas 2 Langkah 5 tanpa
  DDL, kecuali kasus 9-10 yang memakai PO lama (lewati keduanya; PO lama sungguhan tidak ada yang
  berstatus draf). Harapan: kasus 1-8, 11-13 sesuai harapan.
- [ ] **Langkah 4: Periksa produksi tidak terganggu:**

```sql
select count(*) filter (where versi_iom is null) as tanpa_stempel, count(*) as semua from po;
select status, count(*) from po group by status;
```

  Harapan: semua PO lama tanpa stempel (2 per 17 Sep 2026), status tidak berubah.
- [ ] **Langkah 5: Advisor keamanan** (`get_advisors` jenis security). Harapan: tidak ada temuan baru.

---

### Tugas 4: Bendera permintaan tambahan di aplikasi

**Berkas:** Ubah `lib/po-aksi.ts`, `lib/isi-po-form.ts`, `lib/checklist.ts`,
`app/(sistem)/po/baru/use-form-po.ts`, `app/(sistem)/po/baru/langkah/penanda.tsx`,
`app/(sistem)/po/[id]/page.tsx`, `uji/isi-po.test.mjs`, `uji/emas/isi-po-*.json`, uji checklist
yang sudah ada untuk `fungsiTerdampak`.

- [ ] **Langkah 1: Uji dulu.** Di `uji/isi-po.test.mjs`, tambahkan `permintaanTambahan: false` ke
  objek `lain`, dan di kasus `unggahan` pakai `lain: { ...lain, masaMulai: '', permintaanTambahan: true }`.
  Di uji yang menguji `fungsiTerdampak` (cari dengan `grep -ln fungsiTerdampak uji/`), tambahkan:

```js
assert.deepEqual(fungsiTerdampak(['permintaan_tambahan']), ['tech_ops']);
```

  Jalankan `npm run periksa`. Harapan: GAGAL (rekaman kiriman berbeda; tech_ops belum memetakan).
- [ ] **Langkah 2: `lib/isi-po-form.ts`.** Di `MasukanIsiPo.lain` tambahkan `permintaanTambahan: boolean;`.
  Di objek hasil `susunIsiPo`, sesudah `asal: p.asal,` tambahkan `permintaanTambahan: p.lain.permintaanTambahan,`.
- [ ] **Langkah 3: `lib/po-aksi.ts`.** `IsiPo` tambahkan
  `/** b4: Sales menyatakan ada permintaan di luar paket; PO jadi diverifikasi manual. */ permintaanTambahan?: boolean;`.
  `kolomIsi` tambahkan `permintaan_tambahan: !!isi.permintaanTambahan,`. Kueri `lama` tambahkan
  kolom `permintaan_tambahan` di daftar select. Di blok `berubah`, sesudah baris `sponsorship`:
  `if (!!(lama as { permintaan_tambahan?: boolean }).permintaan_tambahan !== !!isi.permintaanTambahan) berubah.push('permintaan_tambahan');`
- [ ] **Langkah 4: `lib/checklist.ts`.** `WILAYAH.tech_ops` tambahkan `'permintaan_tambahan'`, dan
  komentar di atas `WILAYAH`: `// permintaan_tambahan masuk Tech Ops karena b4 (permintaan penambahan produk) milik Tech Ops.`
- [ ] **Langkah 5: `use-form-po.ts`.** Di `useState` `lain` tambahkan
  `permintaanTambahan: awal?.permintaanTambahan ?? false,`.
- [ ] **Langkah 6: `po/[id]/page.tsx`.** Di objek `awal` sesudah `namaSm` tambahkan
  `permintaanTambahan: po.permintaan_tambahan ?? false,`. Pastikan select PO memuat kolom itu
  (bila select memakai `*`, sudah).
- [ ] **Langkah 7: `langkah/penanda.tsx`.** Sesudah `</div>` penutup `.isian`, sebelum `</section>`:

```tsx
          <label className="baris" style={{ padding: '12px 16px' }}>
            <input type="checkbox" checked={lain.permintaanTambahan}
              onChange={(e) => setLain({ ...lain, permintaanTambahan: e.target.checked })} />
            <span>
              <span className="nama">Ada permintaan penambahan produk atau layanan di luar paket</span>
              <span className="meta">
                Centang bila sekolah meminta fitur atau layanan yang tidak ada di paket. PO ini lalu
                diverifikasi manual, karena permintaannya butuh komitmen Tech Ops.
              </span>
            </span>
          </label>
```

- [ ] **Langkah 8: Rekam ulang kiriman dengan sengaja.** `BUAT_EMAS=1 node uji/isi-po.test.mjs`, lalu
  `git diff uji/emas/isi-po-*.json`. Harapan: SATU-SATUNYA perubahan tiap berkas adalah baris
  `"permintaanTambahan": false` (atau `true` untuk unggahan). Selain itu, BERHENTI.
- [ ] **Langkah 9:** `npm run periksa`, `npm run build`, `node uji/pindai-bundel.mjs`. Harapan: lolos.
- [ ] **Langkah 10: Lihat layarnya.** `npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-wizard.tsx penanda`,
  buka `_wizard-penanda-*-terang.html` dan `-gelap.html` di Browser pane (server `pratinjau-statis`,
  perbarui `--directory` di `~/.claude/launch.json` ke `~/Projects/Skolla/skolla-kerjasama`), lebar
  1200 dan 375. Harapan: kotak centang terbaca di dua tema, tidak meluber, target ≥44px. Saring
  teksnya dengan skill antislop (copywriting, human).
- [ ] **Langkah 11: Commit.**

```bash
git add lib/po-aksi.ts lib/isi-po-form.ts lib/checklist.ts "app/(sistem)/po/baru/use-form-po.ts" "app/(sistem)/po/baru/langkah/penanda.tsx" "app/(sistem)/po/[id]/page.tsx" uji/isi-po.test.mjs uji/emas/isi-po-berkelompok.json uji/emas/isi-po-satu.json uji/emas/isi-po-unggahan.json
git commit -m "IoM Fase 1 3/5: bendera permintaan tambahan di wizard"
```

  (Tambahkan berkas uji checklist yang diubah di Langkah 1 ke `git add`.)

---

### Tugas 5: Pesan manusia, QA, rilis

- [ ] **Langkah 1: Pesan sampai ke Sales.** Bukti dibatalkan: sebagai `authenticated`, PO berstempel
  tanpa termin, panggil update status seperti `kirimUntukTtd`; salin teks galatnya. Harapan diawali
  `PO belum bisa dikirim:` dan tanpa kode teknis. `panel-ttd.tsx` baris 70 menampilkan `galat` apa
  adanya; tidak perlu kode tambahan. Bila teks galat PostgREST membawa awalan teknis, tulis
  penerjemah kecil di `kirimUntukTtd` dan `ajukanUnggahan` yang mengambil kalimat sesudah
  `PO belum bisa dikirim:`, berikut ujinya.
- [ ] **Langkah 2: QA independen** (agen terpisah). Brief: tinjau `git diff <commit sebelum Tugas 1>..HEAD`
  terhadap `catatan/13a` Bagian 1, 2, 4, 7 dan rencana ini; periksa kedua sisi setiap aturan di
  `lib/iom.ts`; periksa migrasi terhadap definisi hidup (hanya baca); periksa wizard dua tema dan
  375px; DILARANG membaca isi `.env*`, DILARANG mengubah basis data atau men-deploy. Perbaiki temuan,
  ulangi QA sampai PASS.
- [ ] **Langkah 3: Deploy.** Cadangkan `.env.local` (salin + banding sidik), `vercel deploy --prod --yes`,
  pastikan `.env.local` utuh, rute produksi 307 ke `/masuk`, pindai chunk publik.
- [ ] **Langkah 4: Catat** di `catatan/13` (Fase 1 tayang, hasil QA) dan kotak centang rencana ini,
  commit `"IoM Fase 1 5/5: QA dan rilis"`. Push hanya bila Rizki meminta.

## Di luar lingkup rencana ini

- Tabel `verifikasi_otomatis`, `deklarasi_kesiapan`, RPC verdict, dan penyambungan `nilai()` ke alur
  verifikasi: Fase 2 dan 3 `catatan/13`.
- Tabel persetujuan deviasi harga (selama belum ada, `tanpa-diskon` membuat setiap diskon manual).
- Pemetaan kotak "Tipe Paket" kertas ke paket (spesifikasi pembacaan scan, sesudah verifikasi otomatis).
