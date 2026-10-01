# Rencana Kerja: IoM Fase 3a (antarmuka verdict, antrean dan penutupan HoO)

> **Untuk agen pelaksana:** WAJIB memakai superpowers:executing-plans (atau
> superpowers:subagent-driven-development) untuk menjalankan rencana ini tugas demi tugas.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** Verdict IoM yang sudah dihitung basis data (Fase 2) terlihat dan bisa dipakai:
halaman PO menampilkan hasil dan alasannya, Head of Operations menemukan PO yang lolos di
Antrean Verifikasi dan menutupnya dengan satu klik, keempat fungsi tidak lagi diminta memeriksa
PO yang lolos, dan berkas gambar tanda tangan putaran lama dibersihkan saat PO dikirim ulang.

**Arsitektur:** Tanpa perubahan basis data. Aplikasi hanya MEMBACA `verifikasi_otomatis` (baris
terakhir per PO) lewat relasi PostgREST, dan menutup lewat RPC `tutup_verifikasi_otomatis`
yang syaratnya ditegakkan basis data. Logika penentu (verdict terakhir, keadaan basi/lolos/gagal,
pembagian antrean) berupa fungsi murni di `lib/verdict-iom.ts` supaya teruji. Surat Verifikasi
Kesiapan untuk PO otomatis DIBLOKIR di aplikasi sampai Fase 3b.

> **STATUS: SELESAI, TAYANG DI PRODUKSI 17 Sep 2026** (commit `15e5d96`). QA tiga putaran, lihat
> `catatan/13` Fase 3. Menyimpang dari rencana: `keadaanVerdict` menerima konteks (penolakan,
> deklarasi, ada HoO selain pembuat) dan punya keadaan `tertahan`; `bagiAntrean` menerima deklarasi,
> tanggal Jakarta, dan email HoO; `finalisasiSurat` ikut menahan; Penerbitan Surat memisahkan PO
> otomatis.

**Teknologi:** Next.js 16 App Router, React 19, Supabase, uji `node --test` + `uji/muat.mjs`.

**Spesifikasi:** `catatan/13` Fase 3 (masukan dari Fase 2 dan keputusan 17 Sep 2026),
`catatan/15` (objek basis data yang dipakai), `DESIGN.md`.

## Batasan global

- Tidak ada migrasi. Yang boleh dan tidak boleh tetap diputuskan basis data; layar hanya
  menyembunyikan tombol yang pasti ditolak dan menampilkan pesan galat basis data apa adanya.
- Peran HoO dicek HARFIAH (`peran.includes('head_of_operations')`), bukan lewat `berperan()`
  yang meloloskan admin_utama: cerminan `private.peran_saya()` di basis data.
- Teks layar: tanpa tanda pisah panjang; dua tema; target sentuh ≥44px di ≤520px; garis kiri
  hanya pada kotak keadaan (`.halangan`, `.pesan`); saring dengan skill antislop.
- QA independen sebelum deploy produksi; brief melarang membaca isi `.env*`. Cadangkan
  `.env.local` sebelum deploy. Commit jalur eksplisit.

## Peta berkas

| Berkas | Tugas | Isi |
|---|---|---|
| `lib/verdict-iom.ts` (baru) | 1 | label aturan, verdict terakhir, keadaan, pembagian antrean |
| `uji/verdict-tampil.test.mjs` (baru) | 1 | uji fungsi murni + label lengkap |
| `lib/supabase-server.ts` | 1 | `adalahHoO` harfiah |
| `lib/po-aksi.ts` | 2, 4 | aksi `tutupVerifikasiOtomatis`; `kirimUntukTtd` bersihkan berkas |
| `app/(sistem)/po/[id]/page.tsx`, `panel-verifikasi.tsx` | 2 | kartu verdict + tombol HoO |
| `lib/surat-aksi.ts`, `app/(sistem)/po/[id]/surat/page.tsx` | 2 | blokir Surat PO otomatis |
| `app/(sistem)/verifikasi/page.tsx`, `app/(sistem)/layout.tsx` | 3 | antrean HoO, sembunyikan dari fungsi, menu |
| `uji/pratinjau-verdict.tsx` (baru) | 5 | pratinjau kartu verdict dua tema |

---

### Tugas 1: Fungsi murni verdict dan peran HoO

- [x] **Langkah 1: Uji dulu** `uji/verdict-tampil.test.mjs`:

```js
// Tampilan verdict IoM (catatan/16). Yang dijaga: setiap kode aturan punya label manusia,
// verdict yang dipakai selalu baris TERAKHIR, verdict versi lama tidak dianggap lolos, dan PO
// yang lolos keluar dari antrean keempat fungsi.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const V = muat('verdict-iom');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const kodeMesin = [...readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8').matchAll(/cek\('([a-z-]+)'/g)]
  .map((m) => m[1]);
for (const k of [...kodeMesin, 'galat-evaluasi'])
  assert.ok(V.LABEL_ATURAN[k] && !V.LABEL_ATURAN[k].includes('—'), `label ${k} hilang atau memakai tanda pisah`);
ok(`${kodeMesin.length + 1} kode aturan punya label tanpa tanda pisah`);

const baris = (lolos, versi_po, dicatat_pada) => ({ lolos, versi_po, dicatat_pada, gagal: [], hasil: [], paket: null, versi_iom: 'x' });
assert.equal(V.verdictTerakhir(null), null);
assert.equal(V.verdictTerakhir([baris(false, 1, '2026-09-17T01:00:00+00:00'), baris(true, 1, '2026-09-17T02:00:00+00:00')]).lolos, true);
assert.equal(V.verdictTerakhir([baris(true, 1, '2026-09-17T02:00:00+00:00'), baris(false, 1, '2026-09-17T01:00:00+00:00')]).lolos, true);
ok('verdict terakhir dipilih menurut dicatat_pada, bukan urutan larik');

assert.equal(V.keadaanVerdict(null, 1), 'tidak-ada');
assert.equal(V.keadaanVerdict(baris(true, 1, 'a'), 2), 'basi');
assert.equal(V.keadaanVerdict(baris(true, 2, 'a'), 2), 'lolos');
assert.equal(V.keadaanVerdict(baris(false, 2, 'a'), 2), 'gagal');
ok('keadaan: tidak ada, basi bila versi PO berubah, lolos, gagal');

const po = (id, versi, verdict) => ({ id, versi, verifikasi_otomatis: verdict });
const antrean = [
  po('lolos', 1, [baris(true, 1, '2026-09-17T02:00:00+00:00')]),
  po('gagal', 1, [baris(false, 1, '2026-09-17T02:00:00+00:00')]),
  po('basi', 2, [baris(true, 1, '2026-09-17T02:00:00+00:00')]),
  po('lama', 1, []),
];
const { otomatis, manual } = V.bagiAntrean(antrean);
assert.deepEqual(otomatis.map((p) => p.id), ['lolos']);
assert.deepEqual(manual.map((p) => p.id), ['gagal', 'basi', 'lama']);
ok('antrean: hanya verdict terakhir yang lolos untuk versi PO sekarang yang keluar dari antrean fungsi');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [x] **Langkah 2:** `node --test uji/verdict-tampil.test.mjs`. Harapan: GAGAL (`lib/verdict-iom.ts` belum ada).

- [x] **Langkah 3: Tulis `lib/verdict-iom.ts`:**

```ts
/**
 * Tampilan verdict IoM (catatan/16). Verdict dihitung basis data (catatan/15); modul ini hanya
 * membacanya. Murni dan tanpa impor nilai, jadi aman di peramban dan teruji.
 *
 * Yang ditampilkan "lolos" di sini hanya kandidat: penutupan tetap ditegakkan basis data
 * (peran HoO harfiah, nol penolakan, versi IoM berlaku, deklarasi masih berlaku, bukan pembuat).
 */

export type BarisVerdict = {
  lolos: boolean;
  gagal: string[];
  hasil: { kode: string; lolos: boolean; bukti: string }[];
  paket: string | null;
  versi_po: number;
  versi_iom: string;
  dicatat_pada: string;
};

/** Label manusia per kode aturan `lib/iom.ts` (dijaga uji: tidak boleh ada yang hilang). */
export const LABEL_ATURAN: Record<string, string> = {
  'po-berstempel-iom': 'Dibuat di bawah aturan IoM',
  'sekolah-terisi': 'Nama sekolah terisi',
  'komponen-dikenal': 'Semua komponen dikenal pricelist',
  'jumlah-siswa-minimal': 'Jumlah siswa minimal 1',
  'minimal-peserta': 'Batas minimal peserta terpenuhi',
  'kapasitas-sesi': 'Kapasitas sesi cukup',
  'termin-sama-total': 'Total termin sama dengan grand total',
  'unggahan-ditinjau': 'Pindaian sudah dinyatakan sesuai',
  'masa-aktif-lengkap': 'Masa aktif lengkap',
  'masa-aktif-wajar': 'Masa aktif berakhir sesudah mulai',
  'sekolah-lengkap': 'Data sekolah lengkap',
  'satu-kelompok': 'PO satu kelompok',
  'paket-persis': 'Komponen persis satu paket',
  'layanan-sesuai-paket': 'Layanan sesuai paket',
  'deklarasi-berlaku': 'Deklarasi kesiapan paket berlaku',
  'lantai-siswa': 'Harga siswa tidak di bawah bottom price',
  'lantai-guru': 'Tanpa pelatihan guru',
  'tanpa-diskon': 'Harga siswa tanpa diskon dari price list',
  'tanpa-pengecualian-hoo': 'Tanpa pengecualian Head of Operations',
  'tanpa-sponsorship': 'Tanpa sponsorship',
  'tanpa-permintaan-tambahan': 'Tanpa permintaan di luar paket',
  'galat-evaluasi': 'Penilaian otomatis gagal dijalankan',
};

/** Baris dengan `dicatat_pada` terbesar. Stempel waktu PostgREST satu zona, jadi urutan teks = urutan waktu. */
export function verdictTerakhir<T extends { dicatat_pada: string }>(daftar: T[] | null | undefined): T | null {
  return (daftar ?? []).reduce<T | null>((a, v) => (!a || v.dicatat_pada > a.dicatat_pada ? v : a), null);
}

export type KeadaanVerdict = 'tidak-ada' | 'lolos' | 'gagal' | 'basi';

/** `basi`: verdict untuk versi PO lama; basis data tidak akan menerimanya untuk penutupan. */
export function keadaanVerdict(v: { lolos: boolean; versi_po: number } | null, versiPo: number): KeadaanVerdict {
  if (!v) return 'tidak-ada';
  if (v.versi_po !== versiPo) return 'basi';
  return v.lolos ? 'lolos' : 'gagal';
}

/** Memisahkan PO berstatus verifikasi: yang lolos otomatis ke HoO, sisanya tetap ke keempat fungsi. */
export function bagiAntrean<T extends { versi: number; verifikasi_otomatis?: { lolos: boolean; versi_po: number; dicatat_pada: string }[] | null }>(
  daftar: T[],
): { otomatis: T[]; manual: T[] } {
  const otomatis: T[] = [];
  const manual: T[] = [];
  for (const p of daftar)
    (keadaanVerdict(verdictTerakhir(p.verifikasi_otomatis), p.versi) === 'lolos' ? otomatis : manual).push(p);
  return { otomatis, manual };
}
```

- [x] **Langkah 4:** Di `lib/supabase-server.ts`, sesudah `adalahLead`:

```ts
/**
 * Head of Operations, HARFIAH: tidak lewat `berperan()` yang meloloskan admin_utama. Cerminan
 * `private.peran_saya()` pada penutupan verifikasi otomatis (catatan/15): Super Admin tanpa
 * peran HoO ditolak basis data, jadi tombolnya juga tidak ditampilkan untuknya.
 */
export const adalahHoO = (p: Peran[]) => p.includes('head_of_operations');
```

- [x] **Langkah 5:** `node --test uji/verdict-tampil.test.mjs` lalu `npm run periksa`. Harapan: lolos.
- [x] **Langkah 6: Mutasi:** ganti `v.dicatat_pada > a.dicatat_pada` jadi `<`; ganti `v.versi_po !== versiPo` jadi
  `false`. Masing-masing harus membuat uji gagal. Kembalikan.
- [x] **Langkah 7: Commit** `lib/verdict-iom.ts uji/verdict-tampil.test.mjs lib/supabase-server.ts`,
  pesan `"IoM Fase 3a 1/5: fungsi tampilan verdict dan peran HoO harfiah"`.

---

### Tugas 2: Kartu verdict, tombol HoO, dan blokir Surat PO otomatis

- [x] **Langkah 1: Aksi server** di `lib/po-aksi.ts`, sesudah `tutupVerifikasi`:

```ts
/**
 * Head of Operations menutup PO yang lolos verifikasi otomatis IoM (catatan/15). Seluruh syarat
 * ditegakkan basis data (RPC + trigger penutupan); pesannya diteruskan apa adanya.
 */
export async function tutupVerifikasiOtomatis(poId: string): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  const sb = await supabaseServer();
  const { error } = await sb.rpc('tutup_verifikasi_otomatis', { p_po: poId });
  if (error) return { ok: false, galat: error.message };
  revalidatePath(`/po/${poId}`);
  revalidatePath('/verifikasi');
  revalidatePath('/po');
  revalidatePath('/surat');
  return { ok: true };
}
```

- [x] **Langkah 2: Halaman PO** (`app/(sistem)/po/[id]/page.tsx`):
  - Tambahkan `verifikasi_otomatis(lolos, gagal, hasil, paket, versi_po, versi_iom, dicatat_pada)` ke string
    `select` PO (sesudah `verifikasi(*)`).
  - Impor `adalahHoO` dari `@/lib/supabase-server` dan `verdictTerakhir, type BarisVerdict` dari `@/lib/verdict-iom`.
  - Pada `<PanelVerifikasi ...>` tambahkan prop:

```tsx
        verdict={verdictTerakhir((po.verifikasi_otomatis ?? []) as BarisVerdict[])}
        versiPo={po.versi}
        adalahHoO={adalahHoO(peran)}
        pembuatSaya={po.dibuat_oleh === hasil.pengguna.email}
```

- [x] **Langkah 3: `panel-verifikasi.tsx`.**
  - Impor: tambahkan `tutupVerifikasiOtomatis` ke impor `@/lib/po-aksi`, dan
    `import { LABEL_ATURAN, keadaanVerdict, type BarisVerdict } from '@/lib/verdict-iom';`.
  - Tambahkan ke tipe props dan destrukturisasi: `verdict: BarisVerdict | null; versiPo: number; adalahHoO: boolean; pembuatSaya: boolean;`.
  - Ubah syarat keluar awal supaya kartu tetap tampil bila ada verdict:
    `if (status !== 'verifikasi' && !keputusan.length && !verdict) { if (status !== 'ditolak') return null; }`
  - Sisipkan tepat sesudah paragraf keterangan (sesudah `</p>` pertama di dalam `<section>`):

```tsx
      {verdict && (() => {
        const keadaan = keadaanVerdict(verdict, versiPo);
        const gagal = verdict.hasil.filter((h) => !h.lolos);
        return (
          <div className="kotak" style={{ padding: '16px 20px', marginTop: 12 }}>
            <div className="riwayat-kepala">
              <strong>Verifikasi otomatis IoM</strong>
              <span className={`lencana ${keadaan === 'lolos' ? 'hijau' : keadaan === 'gagal' ? 'merah' : ''}`}>
                {keadaan === 'lolos' ? 'Lolos' : keadaan === 'gagal' ? 'Perlu verifikasi manual' : 'Untuk versi PO lama'}
              </span>
              <span className="muted">{verdict.versi_iom}</span>
            </div>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13.5 }}>
              {keadaan === 'lolos'
                ? `Paket ${verdict.paket}. Keempat fungsi tidak perlu memeriksa; Head of Operations menutup tahap verifikasi.`
                : keadaan === 'gagal'
                  ? 'PO ini tidak memenuhi aturan otomatis, jadi diputuskan keempat fungsi seperti biasa.'
                  : 'Isi PO berubah sesudah dinilai. Penilaian baru dibuat saat PO masuk verifikasi lagi.'}
            </p>
            {keadaan === 'gagal' && gagal.length > 0 && (
              <div className="halangan" style={{ marginTop: 10 }}>
                <b>Aturan yang tidak terpenuhi</b>
                <ul>
                  {gagal.map((h) => (
                    <li key={h.kode}>{LABEL_ATURAN[h.kode] ?? h.kode}: <span className="muted">{h.bukti}</span></li>
                  ))}
                </ul>
              </div>
            )}
            {keadaan === 'lolos' && status === 'verifikasi' && adalahHoO && (
              pembuatSaya ? (
                <p className="muted" style={{ margin: '10px 0 0', fontSize: 13.5 }}>
                  Kamu pembuat PO ini, jadi penutupannya tidak bisa olehmu. PO ini diverifikasi keempat fungsi.
                </p>
              ) : (
                <div className="ttd-aksi">
                  <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }} disabled={kerja}
                    onClick={() => aksi(() => tutupVerifikasiOtomatis(poId))}>
                    {kerja ? 'Menutup…' : 'Nyatakan terverifikasi'}
                  </button>
                </div>
              )
            )}
          </div>
        );
      })()}
```

- [x] **Langkah 4: Blokir Surat PO otomatis sampai Fase 3b.** Di `lib/surat-aksi.ts` `simpanTtdSurat`, sesudah
  pemeriksaan `po.status !== 'terverifikasi'`:

```ts
  // Fase 3b (catatan/13): kalimat Surat untuk PO yang lolos verifikasi otomatis menunggu tinjauan
  // legal. Tanpa empat keputusan fungsi, kalimat "dari sisi ..." tercetak kosong.
  const { count: hijau } = await sb.from('verifikasi').select('fungsi', { count: 'exact', head: true })
    .eq('po_id', poId).eq('berlaku', true).neq('hasil', 'tolak');
  if ((hijau ?? 0) < 4)
    return { ok: false, galat: 'PO ini lolos verifikasi otomatis. Surat untuk PO seperti ini belum bisa diterbitkan: kalimatnya menunggu persetujuan legal.' };
```

  Di `app/(sistem)/po/[id]/surat/page.tsx`, sesudah blok `if (!SETELAH_VERIFIKASI.includes(po.status))`:

```tsx
  const hijau = ((po.verifikasi ?? []) as { hasil: string; berlaku: boolean }[])
    .filter((v) => v.berlaku && v.hasil !== 'tolak').length;
  if (hijau < 4) {
    return (
      <main className="wrap">
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>Surat Belum Bisa Diterbitkan</h1>
        <div className="kosong" style={{ marginTop: 16 }}>
          <strong>PO ini lolos verifikasi otomatis</strong>
          <p>
            Surat Verifikasi Kesiapan untuk PO yang lolos otomatis menunggu kalimat yang disetujui legal.
            Sampai itu, PO ini tetap terverifikasi dan belum bisa dilanjutkan ke PKS.
          </p>
        </div>
        <Link href={`/po/${id}`} className="preset" style={{ marginTop: 16, display: 'inline-block' }}>
          Kembali ke PO
        </Link>
      </main>
    );
  }
```

- [x] **Langkah 5:** `npm run periksa`, `npm run build`, `node uji/pindai-bundel.mjs`. Harapan: lolos.
- [x] **Langkah 6: Commit** jalur `lib/po-aksi.ts "app/(sistem)/po/[id]/page.tsx" "app/(sistem)/po/[id]/panel-verifikasi.tsx" lib/surat-aksi.ts "app/(sistem)/po/[id]/surat/page.tsx"`,
  pesan `"IoM Fase 3a 2/5: kartu verdict, tombol HoO, Surat PO otomatis ditahan"`.

---

### Tugas 3: Antrean Verifikasi untuk HoO dan keempat fungsi

- [x] **Langkah 1: `app/(sistem)/verifikasi/page.tsx`.**
  - Impor `adalahHoO` dari `@/lib/supabase-server` dan `bagiAntrean, verdictTerakhir` dari `@/lib/verdict-iom`.
  - Sesudah `const lead = adalahLead(peran);` tambahkan `const hoo = adalahHoO(peran);`, dan ubah pengalihan jadi
    `if (!fungsiSaya.length && !lead && !hoo) redirect('/beranda');`.
  - Tipe `Baris` tambah `versi: number; verifikasi_otomatis: { lolos: boolean; versi_po: number; dicatat_pada: string; paket: string | null }[] | null;`
  - `KOLOM` tambah `versi, verifikasi_otomatis(lolos, versi_po, dicatat_pada, paket)`.
  - Ganti `const menunggu = antrean.filter((p) => !sudahDiputus(p));` dengan:

```ts
  // PO yang lolos otomatis tidak butuh keempat fungsi (keputusan Rizki 17 Sep 2026, catatan/13).
  const { otomatis, manual } = bagiAntrean(antrean);
  const menunggu = manual.filter((p) => !sudahDiputus(p));
```

  - Sesudah `</header>`, sebelum judul "Sedang Diverifikasi", tambahkan bagian HoO:

```tsx
      {hoo && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>
            Lolos Otomatis, Menunggu Penutupan{otomatis.length ? ` (${otomatis.length})` : ''}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            PO yang memenuhi seluruh aturan IoM. Buka PO-nya untuk melihat penilaian dan menutup tahap verifikasi.
          </p>
          {!otomatis.length ? (
            <div className="kosong"><strong>Tidak ada PO yang menunggu penutupanmu</strong></div>
          ) : (
            <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
              <div className="gulir">
                <table className="tabel-daftar">
                  <thead><tr><th>Nomor</th><th>Sekolah</th><th>Paket</th><th>Siswa</th><th>Nilai</th><th>Dinilai</th></tr></thead>
                  <tbody>
                    {otomatis.map((p) => {
                      const s = p.sekolah as unknown as { nama: string; jenjang: string } | null;
                      const v = verdictTerakhir(p.verifikasi_otomatis);
                      return (
                        <tr key={p.id}>
                          <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                          <td>{s?.nama ?? '-'} <span className="muted">{s?.jenjang}</span></td>
                          <td>{v?.paket ?? '-'}</td>
                          <td>{p.jumlah_siswa}</td>
                          <td>{rp(p.grand_total)}</td>
                          <td className="muted">{v ? tgl(v.dicatat_pada) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
```

  - Paragraf kepala: bila `hoo && !fungsiSaya.length && !lead`, teksnya
    `'Kamu menutup PO yang lolos verifikasi otomatis sebagai Head of Operations.'`.

- [x] **Langkah 2: Menu** (`app/(sistem)/layout.tsx`): impor `adalahHoO`, ubah syarat menu Antrean Verifikasi jadi
  `if (adalahVerifikator(pengguna.peran) || adalahHoO(pengguna.peran))`.
- [x] **Langkah 3:** `npm run periksa`, `npm run build`. Harapan: lolos.
- [x] **Langkah 4: Commit** `"app/(sistem)/verifikasi/page.tsx" "app/(sistem)/layout.tsx"`,
  pesan `"IoM Fase 3a 3/5: antrean HoO, PO lolos otomatis keluar dari antrean fungsi"`.

---

### Tugas 4: Bersihkan berkas tanda tangan lama saat kirim ulang

- [x] **Langkah 1:** Ganti isi `kirimUntukTtd` di `lib/po-aksi.ts`:

```ts
export async function kirimUntukTtd(id: string): Promise<{ ok: boolean; galat?: string }> {
  const sb = await supabaseServer();
  const { data, error } = await sb.from('po').update({ status: 'menunggu_ttd' })
    .eq('id', id).in('status', ['draf', 'ditolak']).select('id');
  if (error) return { ok: false, galat: error.message };
  // Basis data (po_urutan_status) menghapus BARIS tanda tangan putaran lama; berkas gambarnya
  // di storage dihapus di sini, sesudah lompatan status berhasil, karena kebijakan hapus berkas
  // menuntut status menunggu_ttd. Tanpa ini berkasnya tertinggal di luar jangkauan retensi.
  if (data?.length)
    await sb.storage.from('tanda-tangan').remove(URUT_PIHAK.map((p) => `${id}/${p}.png`));
  revalidatePath(`/po/${id}`);
  revalidatePath('/po');
  return { ok: true };
}
```

- [x] **Langkah 2:** `npm run periksa`. Commit `lib/po-aksi.ts`, pesan `"IoM Fase 3a 4/5: hapus berkas tanda tangan putaran lama saat kirim ulang"`.

---

### Tugas 5: Pratinjau, penyaring, QA, rilis

- [x] **Langkah 1: Pratinjau** `uji/pratinjau-verdict.tsx`: render `PanelVerifikasi` (bungkus `AppRouterContext.Provider`
  seperti `uji/pratinjau-wizard.tsx`, dengan `<meta name="viewport">`) untuk empat kasus: lolos + HoO (tombol tampil),
  lolos + HoO pembuat, gagal (tiga aturan dengan bukti), basi; tema terang dan gelap, ke `_verdict-<kasus>-<tema>.html`.
  Tambahkan `_verdict-*` ke `.gitignore`. Periksa di Browser pane lewat server `pratinjau-statis` pada 1200 dan 375:
  tanpa luber, tombol ≥44px di ≤520px, lencana terbaca dua tema. Saring teks dengan antislop (copywriting, human).
- [x] **Langkah 2: QA independen.** Brief: tinjau `git diff <sebelum Tugas 1>..HEAD` terhadap `catatan/13` Fase 3,
  `catatan/16`, dan objek basis data Fase 2; pastikan tidak ada jalan aplikasi yang melemahkan penjagaan basis data;
  pembagian antrean benar; HoO harfiah; Surat PO otomatis tertahan di aksi DAN halaman; `kirimUntukTtd` tidak menghapus
  berkas bila lompatan gagal; dua tema dan 375px; DILARANG membaca isi `.env*`, DILARANG mengubah basis data atau deploy.
  Perbaiki temuan, ulangi sampai PASS.
- [x] **Langkah 3: Deploy:** cadangkan `.env.local` (banding sidik), fast-forward `main`, `vercel deploy --prod --yes`,
  `.env.local` utuh, rute bersesi 307 ke `/masuk`, pindai chunk publik.
- [x] **Langkah 4: Catat** status 3a di `catatan/13` dan berkas ini; commit `"IoM Fase 3a 5/5: pratinjau, QA, rilis"`.
  Push hanya bila Rizki meminta.

## Di luar lingkup

- **3b** (sesudah legal): kalimat Surat untuk PO otomatis, HoO menandatangani Surat, perubahan RLS `surat_verifikasi` dan
  storage `surat/%`, dan membuka blokir Tugas 2 Langkah 4.
- **3c** (sebelum Feb 2027): layar tanda tangan ulang deklarasi kesiapan.
