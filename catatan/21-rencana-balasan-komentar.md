# Rencana kerja: Balasan pada lini masa PO

> **Untuk agen pelaksana:** SUB-SKILL WAJIB — pakai `superpowers:subagent-driven-development`
> (disarankan) atau `superpowers:executing-plans` untuk mengerjakan rencana ini tugas demi
> tugas. Langkahnya memakai kotak centang (`- [ ]`) supaya kemajuannya bisa ditandai.

**Tujuan:** Membuat setiap peristiwa di lini masa PO bisa dibalas, dengan balasan
bersarang tanpa batas, tanpa mengubah siapa boleh melihat apa.

**Arsitektur:** Balasan ADALAH baris `po_komentar` biasa yang membawa `induk_kunci` —
sebuah kunci peristiwa sintetis yang dihitung `lib/lini-masa.ts`, bukan foreign key.
`liniMasa()` berubah dari larik datar menjadi pohon: peristiwa tingkat atas tetap terbaru
di atas, balasan di dalamnya terlama di atas. Seluruh RLS, sunting, hapus, revisi, dan
penandaan basi ikut apa adanya karena balasan bukan jenis baris baru.

**Tumpukan teknologi:** Next.js 16 App Router, TypeScript, Supabase (Postgres + RLS),
`node --test` tanpa koneksi basis data, `tsx` untuk pratinjau statis.

**Spesifikasi:** `catatan/20-spesifikasi-balasan-komentar.md` — baca lebih dulu. Rencana
ini berargumen dari sana; keduanya dibaca bersamaan.

## Batasan yang berlaku di SEMUA tugas

- **Bahasa:** komentar kode, nama pengenal, pesan galat, dan teks layar dalam **Bahasa
  Indonesia**. Ini aturan repo (`AGENTS.md`), bukan selera.
- **Tidak ada uji yang menyambung basis data.** `npm run uji` wajib jalan tanpa
  kredensial. Penjaga SQL berupa asersi atas BENTUK berkas migrasi.
- **Jangan mematok nama berkas migrasi** di uji. Pakai `migrasiTerakhir(pola)` dari
  `uji/migrasi.mjs`. Uji yang memaku nama berkas sudah menggigit tiga kali dalam satu hari
  (20 Sep 2026).
- **`npm run periksa`** = `tsc --noEmit` + seluruh uji. Wajib hijau sebelum tiap commit.
- **Kedalaman maksimum 50**, ditegakkan di trigger. Indent di layar berhenti di tingkat 4.
- **Kunci peristiwa selain komentar WAJIB diakhiri waktu peristiwanya.** Ini kaidah yang
  paling menentukan di seluruh pekerjaan ini — lihat tugas 3 langkah 1.
- Setiap commit diakhiri baris `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- Jangan sentuh `main`. Kerjakan di cabang `build/balasan-komentar`.

---

## Peta berkas

| Berkas | Tanggung jawab | Tugas |
|---|---|---|
| `supabase/migrasi/20260921_balasan_komentar.sql` (baru) | Kolom, indeks, dua trigger | 1 |
| `uji/komentar-rls.test.mjs` (ubah) | Penjaga bentuk migrasi | 2 |
| `lib/lini-masa.ts` (ubah) | Kunci peristiwa, penyusunan pohon | 3 |
| `uji/lini-masa.test.mjs` (ubah) | Sifat pohon dan kestabilan kunci | 3 |
| `lib/po-aksi.ts` (ubah) | Aksi server `balasKomentar` | 4 |
| `app/(sistem)/po/[id]/komentar.tsx` (ubah) | `KotakBalas`, teks baru | 5 |
| `app/(sistem)/po/[id]/butir-lini.tsx` (baru) | Render satu butir + balasannya, rekursif | 5 |
| `app/(sistem)/po/[id]/page.tsx` (ubah) | Memakai `ButirLini`, lencana rekursif | 5, 6 |
| `app/globals.css` (ubah) | Indent, nisan, tombol balas | 5 |
| `uji/pratinjau-komentar.tsx` (ubah) | Pratinjau utas bersarang, dua tema | 6 |

`butir-lini.tsx` dipisah, bukan ditulis di dalam `page.tsx`: halaman itu sudah 300+ baris
dan render rekursif butuh komponennya sendiri supaya bisa memanggil dirinya.

---

### Tugas 1: Migrasi — kolom, kedalaman, dan pagar

**Berkas:**
- Buat: `supabase/migrasi/20260921_balasan_komentar.sql`

**Antarmuka:**
- Menghasilkan: kolom `po_komentar.induk_kunci text` (null = tingkat atas) dan
  `po_komentar.kedalaman integer not null default 0`. Dipakai tugas 3 dan 4.

Tugas ini **tidak mengubah apa pun yang terlihat**, sama seperti langkah 1 `catatan/09`.

- [ ] **Langkah 1: Tulis migrasinya**

```sql
-- Balasan pada lini masa PO (catatan/20). Tugas 1: kolom, kedalaman, pagar.
--
-- Balasan BUKAN jenis baris baru — ia baris po_komentar biasa yang membawa penambat.
-- Karena itu seluruh RLS, sunting, hapus, revisi, dan penandaan basi ikut apa adanya,
-- dan tidak ada satu pun kebijakan baru di berkas ini.
--
-- Penambatnya KUNCI SINTETIS, bukan foreign key. Alasannya ada tiga dan semuanya sudah
-- ada di kode hari ini: satu baris pks/surat menghasilkan beberapa peristiwa sehingga id
-- baris tidak cukup menunjuk peristiwa mana; tanda_tangan tidak punya kunci pengganti
-- dan BENAR-BENAR dihapus saat PO dikembalikan untuk ditandatangani ulang; dan DDL empat
-- tabel sumber tidak ada di repo ini sama sekali.

alter table po_komentar
  add column if not exists induk_kunci text,
  add column if not exists kedalaman   integer not null default 0;

-- Balasan selalu dicari per PO, tidak pernah lintas PO.
create index if not exists po_komentar_induk on po_komentar (po_id, induk_kunci);

-- ---------------------------------------------------------------------------
-- Saat komentar atau balasan ditulis
-- ---------------------------------------------------------------------------
--
-- Ditulis ULANG UTUH, bukan ditambal: fungsi ini sudah memaku oleh/waktu/versi_po dari
-- kenyataan server, dan penjagaan c_level-nya harus tetap berdiri persis seperti semula.
-- Menyalinnya utuh membuat yang membaca migrasi ini tahu apa saja yang dijaga, tanpa
-- membuka migrasi lama.
create or replace function private.jaga_komentar_baru()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_versi        integer;
  v_saya         text := lower(auth.jwt() ->> 'email');
  v_induk_id     uuid;
  v_induk_po     uuid;
  v_induk_dalam  integer;
begin
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select versi into v_versi from po where id = new.po_id;
  if v_versi is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  new.oleh           := v_saya;
  new.waktu          := now();
  new.versi_po       := v_versi;
  new.disunting_pada := null;
  new.dihapus_pada   := null;
  new.dihapus_oleh   := null;

  -- Kedalaman DIHITUNG di sini, tidak pernah diambil dari kiriman klien. Klien yang
  -- mengarang kedalaman 0 pada balasan tingkat sepuluh membuat pagar di bawah tak ada
  -- artinya.
  new.kedalaman := 0;

  if new.induk_kunci is not null then
    -- Kunci terpanjang yang sah kira-kira 70 karakter (verifikasi:<fungsi>:<ISO>).
    -- Batas ini menutup penambat karangan yang dipakai menitipkan data.
    if length(new.induk_kunci) > 200 then
      raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
    end if;

    -- Hanya penambat ke KOMENTAR yang bisa diperiksa basis data. Penambat ke peristiwa
    -- lain (verifikasi:, ttd:, riwayat:, surat:, pks:) tidak punya baris yang bisa
    -- ditunjuk; kalau peristiwanya hilang, lini masa menampilkannya sebagai nisan.
    if new.induk_kunci like 'komentar:%' then
      begin
        v_induk_id := substring(new.induk_kunci from 10)::uuid;
      exception when others then
        raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
      end;

      select po_id, kedalaman into v_induk_po, v_induk_dalam
        from po_komentar where id = v_induk_id;

      if v_induk_po is null then
        raise exception 'Komentar yang dibalas tidak ditemukan.' using errcode = 'check_violation';
      end if;

      -- Balasan lintas PO tidak membocorkan apa pun (render selalu per-PO), tapi ia data
      -- sampah yang menunggu jadi kebingungan. Ditolak di sini, sekali.
      if v_induk_po <> new.po_id then
        raise exception 'Balasan harus berada di PO yang sama dengan komentar yang dibalas.'
          using errcode = 'check_violation';
      end if;

      new.kedalaman := v_induk_dalam + 1;

      -- Lima puluh tingkat bukan percakapan manusia. Pagarnya ada supaya render rekursif
      -- dan kueri rekursif punya langit-langit, bukan untuk membatasi diskusi.
      if new.kedalaman > 50 then
        raise exception 'Balasan sudah bersarang 50 tingkat. Mulai utas baru di tingkat atas.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_komentar_baru on po_komentar;
create trigger jaga_komentar_baru
  before insert on po_komentar
  for each row execute function private.jaga_komentar_baru();

-- ---------------------------------------------------------------------------
-- Saat komentar disunting
-- ---------------------------------------------------------------------------
--
-- Fungsi ini memaku kolom SATU PER SATU. Kolom baru TIDAK ikut terpaku dengan
-- sendirinya — pola yang sama dengan private.bekukan_isi_po, dan di sana kolom yang lupa
-- didaftarkan tetap bisa diubah lewat PostgREST pada PO yang sudah diteken.
--
-- induk_kunci yang bisa berubah = rantai bisa diarahkan ke keturunannya sendiri =
-- siklus. Dipaku di sini, dan itulah satu-satunya alasan tidak ada penjaga siklus
-- di mana pun: induk hanya bisa ditetapkan saat insert, jadi rantainya cuma tumbuh
-- ke arah masa lalu.
create or replace function private.jaga_komentar_sunting()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  new.id          := old.id;
  new.po_id       := old.po_id;
  new.oleh        := old.oleh;
  new.waktu       := old.waktu;
  new.versi_po    := old.versi_po;
  new.induk_kunci := old.induk_kunci;
  new.kedalaman   := old.kedalaman;

  if new.isi is distinct from old.isi then
    insert into po_komentar_revisi (komentar_id, isi) values (old.id, old.isi);
    new.disunting_pada := now();
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_komentar_sunting on po_komentar;
create trigger jaga_komentar_sunting
  before update on po_komentar
  for each row execute function private.jaga_komentar_sunting();
```

- [ ] **Langkah 2: Terapkan ke basis data**

Jalankan lewat jalur yang biasa dipakai proyek ini (`supabase/README.md`). Migrasi ini
aman diulang: `add column if not exists` dan `create or replace`.

- [ ] **Langkah 3: Buktikan penjaganya LANGSUNG di basis data, manual**

Pola yang sama dengan `catatan/09` dan diagnostik 30 Agu 2026: simulasikan di dalam
transaksi, tunjukkan DITOLAK, lalu `rollback`. Enam hal, satu per satu:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = '{"email":"bintang@skolla.education"}';
-- 1. Sales polos membalas di PO milik orang lain -> harus gagal RLS
insert into po_komentar (po_id, isi, oleh, versi_po, induk_kunci)
values ('<po-milik-sales-lain>', 'coba', 'bintang@skolla.education', 1, null);
rollback;
```

Ulangi untuk: (2) C Level membalas; (3) `induk_kunci` menunjuk komentar milik PO lain;
(4) klien mengirim `kedalaman` 0 pada balasan tingkat tiga — harus tetap terhitung 3;
(5) kedalaman 51 ditolak dengan kalimat yang terbaca; (6) `update po_komentar set
induk_kunci = ...` tidak mengubah apa pun.

**Catat hasilnya di bawah `catatan/20`** sebagai bagian "Langkah 1 — apa yang benar-benar
dibuktikan (21 Sep 2026)". Kalau salah satu LOLOS padahal seharusnya ditolak, berhenti
dan laporkan; jangan lanjut ke tugas 2.

- [ ] **Langkah 4: Commit**

```bash
git add supabase/migrasi/20260921_balasan_komentar.sql catatan/20-spesifikasi-balasan-komentar.md
git commit -m "Balasan komentar 1/6: kolom induk_kunci, kedalaman, dan pagarnya

Belum mengubah apa pun yang terlihat. Trigger ditulis ulang utuh supaya yang
membaca migrasi ini tahu semua yang dijaga tanpa membuka migrasi lama.

jaga_komentar_sunting memaku kolom satu per satu, jadi induk_kunci dan
kedalaman WAJIB didaftarkan di sana — itu yang membuat siklus mustahil.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 2: Penjaga bentuk migrasi

**Berkas:**
- Ubah: `uji/komentar-rls.test.mjs`

**Antarmuka:**
- Memakai: `migrasiTerakhir(pola)` dari `uji/migrasi.mjs`, mengembalikan `{ nama, isi }`.

Uji ini TIDAK membuktikan basis datanya benar — itu tugas 1 langkah 3. Ia menangkap saat
seseorang kelak "merapikan" migrasinya dan diam-diam membuka pintu yang sengaja ditutup.

- [ ] **Langkah 1: Tulis asersi yang gagal**

Tambahkan di akhir `uji/komentar-rls.test.mjs`, sebelum baris ringkasan:

```js
// --- Balasan (catatan/20) --------------------------------------------------
//
// Dibaca dari migrasi TERAKHIR yang mendefinisikan triggernya, bukan nama berkas yang
// dipatok: fungsi yang ditulis ulang di migrasi lebih baru membuat asersi atas berkas
// lama tetap hijau sementara yang terpasang sudah lain.
import { migrasiTerakhir } from './migrasi.mjs';

const baru = migrasiTerakhir(/function private\.jaga_komentar_baru/).isi;
const sunting = migrasiTerakhir(/function private\.jaga_komentar_sunting/).isi;

// Balasan ke komentar WAJIB satu PO dengan induknya.
assert.match(baru, /v_induk_po\s*<>\s*new\.po_id/,
  'trigger tidak memeriksa induk komentar berada di PO yang sama');

// Kedalaman dihitung server. `new.kedalaman :=` harus muncul; yang TIDAK boleh adalah
// membacanya dari kiriman klien sebagai dasar hitungan.
assert.match(baru, /new\.kedalaman\s*:=\s*0/,
  'kedalaman tidak dinolkan lebih dulu — kiriman klien bisa lolos');
assert.match(baru, /new\.kedalaman\s*:=\s*v_induk_dalam\s*\+\s*1/,
  'kedalaman tidak dihitung dari induk');

// Pagar 50, dengan kalimat yang bisa dibaca orang.
assert.match(baru, /new\.kedalaman\s*>\s*50/, 'pagar kedalaman 50 hilang');
assert.match(baru, /Balasan sudah bersarang 50 tingkat/,
  'pagar kedalaman menolak tanpa kalimat yang terbaca');

// Penjagaan c_level harus TETAP berdiri di trigger yang ditulis ulang.
assert.match(baru, /'c_level'\s*=\s*any\s*\(\s*private\.peran_saya\(\)\s*\)/,
  'trigger baru kehilangan penjagaan c_level harfiah');

// Sunting memaku kolom SATU PER SATU. Diperiksa per kolom, bukan dengan mencari kata
// "induk" di mana saja dalam berkas — itu akan hijau hanya karena ada di komentar.
for (const kolom of ['induk_kunci', 'kedalaman']) {
  assert.match(sunting, new RegExp(`new\\.${kolom}\\s*:=\\s*old\\.${kolom}`),
    `jaga_komentar_sunting tidak memaku ${kolom} — ia bisa diubah lewat jalur sunting, dan induk yang bisa diubah berarti siklus`);
}

// Tidak ada kebijakan tulis baru yang diam-diam ditambahkan bersama balasan.
for (const aksi of ['update', 'delete']) {
  assert.ok(!new RegExp(`create policy \\w+ on po_komentar for ${aksi}`, 'i').test(baru),
    `migrasi balasan menambahkan kebijakan ${aksi.toUpperCase()} pada po_komentar`);
}
ok('balasan: induk se-PO, kedalaman dari server, pagar 50, sunting memaku induk');
```

- [ ] **Langkah 2: Jalankan, pastikan GAGAL kalau migrasinya dirusak**

```bash
node --test uji/komentar-rls.test.mjs
```

Harapan: LULUS (migrasi tugas 1 sudah benar). Lalu **buktikan penjaganya benar-benar
menangkap** — hapus sementara baris `new.induk_kunci := old.induk_kunci;` dari migrasi,
jalankan lagi, pastikan GAGAL dengan pesan tentang siklus, lalu kembalikan. Uji yang tidak
pernah terlihat merah adalah jimat.

- [ ] **Langkah 3: Jalankan seluruh pemeriksaan**

```bash
npm run periksa
```

- [ ] **Langkah 4: Commit**

```bash
git add uji/komentar-rls.test.mjs
git commit -m "Balasan komentar 2/6: penjaga bentuk migrasi

Dibaca lewat migrasiTerakhir(), bukan nama berkas yang dipatok. Penjaganya
dibuktikan menangkap dengan merusak migrasinya sementara, bukan cuma hijau.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 3: Lini masa jadi pohon

**Berkas:**
- Ubah: `lib/lini-masa.ts`
- Ubah: `uji/lini-masa.test.mjs`

**Antarmuka:**
- Menghasilkan, dipakai tugas 4, 5, 6:
  - `export const kunciPeristiwa` — objek dengan enam pembuat kunci (lihat kode).
  - `Peristiwa.kunci: string`, `Peristiwa.balasan: Peristiwa[]`, `Peristiwa.yatim?: boolean`.
  - `KomentarTersimpan.induk_kunci?: string | null`.
  - `SumberLiniMasa.riwayat[].id` — **kolom baru di tipe**; datanya sudah tiba lewat
    `po_riwayat(*)`, tipenya saja yang belum menyebutnya.

- [ ] **Langkah 1: Tulis uji yang gagal — kestabilan kunci lebih dulu**

Tambahkan di `uji/lini-masa.test.mjs`. **Butir kedua adalah kaidah terpenting di seluruh
pekerjaan ini**: kalau ia jebol, percakapan menempel ke peristiwa yang salah tanpa suara.

```js
const { liniMasa, kunciPeristiwa } = muat('../lib/lini-masa.ts');

// Kunci sama untuk masukan sama, dua kali render berturut-turut.
{
  const s = { verifikasi: [{ fungsi: 'finance', hasil: 'tolak', catatan: null,
    oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', berlaku: true, sebab_basi: null }] };
  assert.equal(liniMasa(s)[0].kunci, liniMasa(s)[0].kunci);
  assert.equal(liniMasa(s)[0].kunci, 'verifikasi:finance:2026-09-10T01:00:00.000Z');
  ok('kunci peristiwa stabil dan berbentuk sesuai catatan/20');
}

// Tanda tangan yang DIHAPUS lalu dibubuhkan ulang oleh pihak yang sama harus berkunci
// BEDA. Tanpa waktu di dalam kunci, balasan lama menempel diam-diam ke tanda tangan
// baru, dan percakapan tentang tanda tangan yang dibatalkan muncul di bawah
// penggantinya seolah membicarakannya.
{
  const k = (waktu) => liniMasa({ ttd: [{ pihak: 'kepala_sekolah', nama: 'Bu Uji',
    dibubuhkan_oleh: 'a@x', waktu }] })[0].kunci;
  assert.notEqual(k('2026-09-10T01:00:00.000Z'), k('2026-09-11T01:00:00.000Z'));
  ok('tanda tangan ulang berkunci beda — balasan lama tidak diwarisi');
}
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

```bash
node --test uji/lini-masa.test.mjs
```

Harapan: GAGAL dengan `kunciPeristiwa is not a function` atau `kunci` undefined.

- [ ] **Langkah 3: Tambahkan kunci ke `lib/lini-masa.ts`**

Tambahkan sesudah blok `LABEL_PIHAK`:

```ts
/**
 * Penambat balasan (catatan/20).
 *
 * SATU-SATUNYA hal di berkas ini yang wajib stabil selamanya: mengubah bentuk kunci
 * memutus SEMUA balasan dari induknya sekaligus, tanpa cara memulihkannya.
 *
 * Kaidahnya satu — setiap kunci selain komentar diakhiri waktu peristiwanya sendiri.
 * Tanda tangan yang dihapus lalu dibubuhkan lagi oleh pihak yang sama memakai kunci
 * BERBEDA, jadi percakapan tentang tanda tangan yang dibatalkan tidak muncul di bawah
 * penggantinya. Komentar tidak butuh waktu: uuid-nya unik dan permanen, karena komentar
 * dihapus dengan ditandai, tidak pernah dibuang.
 */
export const kunciPeristiwa = {
  komentar: (id: string) => `komentar:${id}`,
  riwayat: (id: number | string) => `riwayat:${id}`,
  ttd: (pihak: string, waktu: string) => `ttd:${pihak}:${waktu}`,
  verifikasi: (fungsi: string, waktu: string) => `verifikasi:${fungsi}:${waktu}`,
  surat: (bagian: 'dibuat' | 'final', waktu: string) => `surat:${bagian}:${waktu}`,
  pks: (bagian: 'dibuat' | 'final' | 'unggah', waktu: string) => `pks:${bagian}:${waktu}`,
};
```

Ubah tipe `Peristiwa`:

```ts
export type Peristiwa = {
  /** Penambat balasan. Lihat kunciPeristiwa. */
  kunci: string;
  waktu: string;
  warna: string;
  judul: string;
  rincian?: string;
  oleh?: string | null;
  komentar?: KomentarLini;
  /** Balasan langsung, TERLAMA DI ATAS — percakapan dibaca dari awal. */
  balasan: Peristiwa[];
  /** Peristiwa yang dibalas sudah tidak ada di lini masa. */
  yatim?: boolean;
};
```

Tambahkan `induk_kunci` ke `KomentarTersimpan`, dan `id` ke `SumberLiniMasa.riwayat`:

```ts
export type KomentarTersimpan = {
  id: string; isi: string; oleh: string; waktu: string; versi_po: number;
  disunting_pada: string | null; dihapus_pada: string | null; dihapus_oleh: string | null;
  /** null = komentar tingkat atas. Lihat catatan/20. */
  induk_kunci?: string | null;
  po_komentar_revisi?: { isi: string; digantikan_pada: string }[];
};
```

```ts
  riwayat?: { id: number | string; status_lama: string | null; status_baru: string;
              versi: number; oleh: string | null; pada: string }[];
```

Lalu beri `kunci` dan `balasan: []` pada SETIAP `p.push({...})` yang sudah ada. Contoh
untuk dua yang pertama; kerjakan keenam sumber dengan pola yang sama:

```ts
    p.push({
      kunci: kunciPeristiwa.riwayat(r.id),
      balasan: [],
      waktu: r.pada,
      warna: revisi ? 'draf' : (WARNA_STATUS[r.status_baru] ?? 'muted'),
      judul: revisi ? `Direvisi menjadi versi ${r.versi}`
                    : (LABEL_STATUS[r.status_baru] ?? r.status_baru),
      oleh: r.oleh,
    });
```

```ts
    p.push({
      kunci: kunciPeristiwa.ttd(t.pihak, t.waktu),
      balasan: [],
      waktu: t.waktu, warna: 'ditandatangani',
      judul: `${LABEL_PIHAK[t.pihak] ?? t.pihak} menandatangani`,
      rincian: t.nama, oleh: t.dibubuhkan_oleh,
    });
```

Sisanya: `verifikasi` → `kunciPeristiwa.verifikasi(v.fungsi, v.waktu)`; surat →
`kunciPeristiwa.surat('dibuat', s.surat.dibuat_pada)` dan `('final', s.surat.final_pada)`;
pks → `('dibuat'|'final'|'unggah', <waktunya masing-masing>)`; komentar →
`kunciPeristiwa.komentar(k.id)`.

- [ ] **Langkah 4: Jalankan, pastikan dua uji kunci lulus**

```bash
node --test uji/lini-masa.test.mjs
```

- [ ] **Langkah 5: Tulis uji pohon yang gagal**

```js
// Balasan tersusun sebagai pohon; tingkat atas terbaru di atas, balasan terlama di atas.
{
  const K = (id, waktu, induk) => ({ id, isi: `k${id}`, oleh: 'a@x', waktu, versi_po: 1,
    disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: induk ?? null });
  const p = liniMasa({ versiPo: 1, komentar: [
    K('a', '2026-09-10T01:00:00.000Z'),
    K('c', '2026-09-10T03:00:00.000Z', 'komentar:a'),
    K('b', '2026-09-10T02:00:00.000Z', 'komentar:a'),
    K('d', '2026-09-10T04:00:00.000Z'),
  ] });
  assert.deepEqual(p.map((e) => e.kunci), ['komentar:d', 'komentar:a'], 'tingkat atas terbaru di atas');
  assert.deepEqual(p[1].balasan.map((e) => e.kunci), ['komentar:b', 'komentar:c'],
    'balasan terlama di atas');
  ok('pohon tersusun: tingkat atas terbaru dulu, balasan terlama dulu');
}

// Balasan TIDAK muncul dua kali.
{
  const p = liniMasa({ versiPo: 1, komentar: [
    { id: 'a', isi: 'a', oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: null },
    { id: 'b', isi: 'b', oleh: 'a@x', waktu: '2026-09-10T02:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null, induk_kunci: 'komentar:a' },
  ] });
  assert.equal(p.length, 1, 'balasan ikut muncul sebagai butir tingkat atas');
  ok('komentar yang jadi balasan tidak muncul dua kali');
}

// Induk yang tidak ada -> kembali ke tingkat atas, ditandai yatim. Ini yang terjadi saat
// tanda tangan dihapus karena PO dikembalikan untuk ditandatangani ulang.
{
  const p = liniMasa({ versiPo: 1, komentar: [
    { id: 'z', isi: 'z', oleh: 'a@x', waktu: '2026-09-10T01:00:00.000Z', versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: 'ttd:kepala_sekolah:2026-09-01T00:00:00.000Z' },
  ] });
  assert.equal(p.length, 1);
  assert.equal(p[0].yatim, true, 'balasan yatim harus ditandai, bukan dihilangkan');
  assert.equal(p[0].komentar.isi, 'z', 'isi balasan yatim tetap utuh');
  ok('balasan yatim kembali ke tingkat atas dengan isinya utuh');
}

// Rantai dalam tersusun benar dan tidak menghabiskan tumpukan.
{
  const komentar = [];
  for (let i = 0; i < 20; i++) {
    komentar.push({ id: `k${i}`, isi: `k${i}`, oleh: 'a@x',
      waktu: `2026-09-10T${String(i).padStart(2, '0')}:00:00.000Z`, versi_po: 1,
      disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
      induk_kunci: i === 0 ? null : `komentar:k${i - 1}` });
  }
  const p = liniMasa({ versiPo: 1, komentar });
  let e = p[0], dalam = 0;
  while (e.balasan.length) { e = e.balasan[0]; dalam++; }
  assert.equal(p.length, 1, 'rantai dalam harus satu butir tingkat atas');
  assert.equal(dalam, 19, 'rantai 20 tingkat tersusun utuh');
  ok('rantai bersarang 20 tingkat tersusun tanpa kehabisan tumpukan');
}
```

- [ ] **Langkah 6: Jalankan, pastikan gagal**

```bash
node --test uji/lini-masa.test.mjs
```

Harapan: GAGAL — `balasan` masih kosong dan semua komentar masih tingkat atas.

- [ ] **Langkah 7: Susun pohonnya**

Ganti baris `return p.sort(...)` di akhir `liniMasa()` dengan:

```ts
  // Penyusunan pohon. Induk dicari lewat kunci, bukan rujukan objek: penambatnya memang
  // string, dan peristiwa yang ditunjuk bisa saja tidak ada lagi.
  const indeks = new Map<string, Peristiwa>();
  for (const e of p) indeks.set(e.kunci, e);

  const indukDari = new Map<string, string | null>();
  for (const k of s.komentar ?? []) {
    indukDari.set(kunciPeristiwa.komentar(k.id), k.induk_kunci ?? null);
  }

  const atas: Peristiwa[] = [];
  for (const e of p) {
    const induk = indukDari.get(e.kunci) ?? null;
    if (!induk) { atas.push(e); continue; }
    const ind = indeks.get(induk);
    if (ind) { ind.balasan.push(e); continue; }
    // Peristiwa yang dibalas sudah tidak ada — tanda tangan yang dibatalkan, biasanya.
    // Balasannya TIDAK disembunyikan: menghilangkan kalimat yang ditulis orang karena
    // peristiwa LAIN dihapus adalah kehilangan yang lebih mahal daripada satu butir
    // yang tampak ganjil.
    e.yatim = true;
    atas.push(e);
  }

  // Balasan terlama di atas: percakapan dibaca dari awal. Kebalikan dari lini masanya
  // sendiri, dan itu disengaja — lini masa dibaca untuk "apa yang terakhir terjadi".
  // Rekursi aman: kedalaman dipagari 50 di basis data, dan siklus mustahil karena induk
  // hanya bisa ditetapkan saat insert.
  const urutkan = (e: Peristiwa) => {
    e.balasan.sort((a, b) =>
      (+new Date(a.waktu) - +new Date(b.waktu)) || a.kunci.localeCompare(b.kunci));
    e.balasan.forEach(urutkan);
  };
  atas.forEach(urutkan);

  return atas.sort((a, b) =>
    (+new Date(b.waktu) - +new Date(a.waktu)) || a.judul.localeCompare(b.judul));
```

- [ ] **Langkah 8: Jalankan seluruh pemeriksaan**

```bash
npm run periksa
```

`tsc` akan menunjukkan setiap tempat yang membaca `Peristiwa` dan belum tahu soal
`kunci`/`balasan`. Perbaiki tipenya; JANGAN ubah perilakunya di tugas ini.

- [ ] **Langkah 9: Commit**

```bash
git add lib/lini-masa.ts uji/lini-masa.test.mjs
git commit -m "Balasan komentar 3/6: lini masa jadi pohon

kunciPeristiwa() adalah satu-satunya hal yang wajib stabil selamanya: mengubah
bentuknya memutus semua balasan dari induknya sekaligus.

Kunci selain komentar diakhiri waktu peristiwanya, supaya tanda tangan yang
dihapus lalu dibubuhkan ulang oleh pihak yang sama tidak mewarisi balasan lama.

Balasan yatim kembali ke tingkat atas dengan isinya utuh, tidak disembunyikan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 4: Aksi server `balasKomentar`

**Berkas:**
- Ubah: `lib/po-aksi.ts`

**Antarmuka:**
- Memakai: kolom `induk_kunci` (tugas 1).
- Menghasilkan: `balasKomentar(poId: string, indukKunci: string, isi: string):
  Promise<{ ok: boolean; galat?: string }>` — dipakai tugas 5.

- [ ] **Langkah 1: Tambahkan aksinya**

Taruh tepat di bawah `tulisKomentar`:

```ts
/**
 * Membalas satu peristiwa lini masa. Balasan adalah baris po_komentar biasa yang membawa
 * penambat, jadi RLS, sunting, hapus, revisi, dan penandaan basi ikut apa adanya.
 *
 * `induk_kunci` dikirim apa adanya ke basis data dan DIPERIKSA DI SANA (trigger
 * jaga_komentar_baru): penambat ke komentar wajib satu PO, kedalaman dihitung server,
 * pagar 50 ditegakkan. Tidak ada pemeriksaan tandingan di sini — memeriksa dua kali di
 * dua tempat dengan aturan yang bisa menyimpang lebih buruk daripada memeriksa sekali
 * di tempat yang tidak bisa dilewati.
 */
export async function balasKomentar(
  poId: string, indukKunci: string, isi: string,
): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (!isi.trim()) return { ok: false, galat: 'Balasan masih kosong.' };
  if (!indukKunci.trim()) return { ok: false, galat: 'Balasan ini tidak punya penambat.' };

  const sb = await supabaseServer();
  const { error } = await sb.from('po_komentar')
    .insert({ po_id: poId, isi, oleh: p.pengguna.email, induk_kunci: indukKunci });
  if (error) return { ok: false, galat: pesanKomentar(error.message) };
  revalidatePath(`/po/${poId}`);
  return { ok: true };
}
```

- [ ] **Langkah 2: Periksa tipe**

```bash
npx tsc --noEmit
```

- [ ] **Langkah 3: Commit**

```bash
git add lib/po-aksi.ts
git commit -m "Balasan komentar 4/6: aksi server balasKomentar

Penambat dikirim apa adanya dan diperiksa di trigger, tidak diperiksa dua kali
di dua tempat dengan aturan yang bisa menyimpang.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 5: Layar — tombol Balas, kotak bersarang, nisan

**Berkas:**
- Ubah: `app/(sistem)/po/[id]/komentar.tsx`
- Buat: `app/(sistem)/po/[id]/butir-lini.tsx`
- Ubah: `app/(sistem)/po/[id]/page.tsx:279-304`
- Ubah: `app/globals.css`

**Antarmuka:**
- Memakai: `balasKomentar` (tugas 4), `Peristiwa.kunci` / `.balasan` / `.yatim` (tugas 3).
- Menghasilkan: `KotakBalas`, `ButirLini` — dipakai tugas 6.

- [ ] **Langkah 1: `KotakBalas` di `komentar.tsx`**

```tsx
/**
 * Kotak balas di bawah satu butir lini masa.
 *
 * Setiap kotak menyimpan isiannya SENDIRI dan beberapa boleh terbuka bersamaan.
 * Rancangan awal "satu kotak pada satu waktu" dibatalkan: menutup kotak lain berarti
 * membuang kalimat yang sudah diketik orang di sana.
 */
export function KotakBalas({ poId, indukKunci }: { poId: string; indukKunci: string }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [isi, setIsi] = useState('');
  const [kerja, mulai] = useTransition();
  const [galat, setGalat] = useState<string | null>(null);

  // `tautan-kecil`, BUKAN `tombol`. Ini disengaja dan ada alasannya di catatan/20
  // ("Risiko yang diterima"): kalau Balas jadi tindakan utama di bawah keputusan
  // verifikasi, alasan sebenarnya sebuah penolakan akan berakhir di utas, bukan di
  // verifikasi.catatan yang ikut basi bersama keputusannya dan terbaca jejak audit.
  // Jangan naikkan jadi tombol utama tanpa membaca bagian itu lebih dulu.
  if (!buka) {
    return (
      <div className="komentar-aksi no-print">
        <button type="button" className="tautan-kecil" onClick={() => setBuka(true)}>Balas</button>
      </div>
    );
  }

  return (
    <div className="f balas-kotak no-print">
      <textarea aria-label="Tulis balasan" value={isi} maxLength={BATAS} autoFocus
        onChange={(e) => setIsi(e.target.value)}
        placeholder="Balas peristiwa ini." />
      <div className="ttd-aksi">
        <button type="button" className="preset" disabled={kerja}
          onClick={() => { setBuka(false); setIsi(''); setGalat(null); }}>Batal</button>
        <button type="button" className="tombol" style={{ width: 'auto', margin: 0 }}
          disabled={kerja || !isi.trim()}
          onClick={() => {
            setGalat(null);
            mulai(async () => {
              const h = await balasKomentar(poId, indukKunci, isi);
              if (h.ok) { setIsi(''); setBuka(false); router.refresh(); }
              else setGalat(h.galat ?? 'Gagal mengirim balasan.');
            });
          }}>
          {kerja ? 'Mengirim…' : 'Kirim balasan'}
        </button>
      </div>
      {galat && <div className="halangan" role="alert" style={{ marginTop: 8 }}><ul><li>{galat}</li></ul></div>}
    </div>
  );
}
```

Tambahkan `balasKomentar` ke baris import di atas berkas.

- [ ] **Langkah 2: Ganti kalimat `KotakKomentar`**

Ganti isi `<span className="bantuan">` di `KotakKomentar` — kalimat sekarang berbunyi
"Utas ini satu dan terbuka", yang terbaca seolah menjanjikan kedataran:

```tsx
      <span className="bantuan">
        Terbaca oleh Sales pemilik PO dan semua peran yang bisa melihat PO ini. Jangan
        menulis hal yang tidak pantas dibaca mereka. Komentar dan balasannya sama-sama
        terbuka; tidak ada bagian yang tersembunyi.
      </span>
```

- [ ] **Langkah 3: `butir-lini.tsx`**

```tsx
/**
 * Satu butir lini masa berikut balasannya, rekursif.
 *
 * Dipisah dari page.tsx karena render rekursif butuh komponen yang bisa memanggil
 * dirinya sendiri, dan halaman itu sudah cukup panjang.
 */
import { IsiKomentar, KotakBalas } from './komentar';
import type { Peristiwa } from '@/lib/lini-masa';

/**
 * Indent berhenti di sini. Di 375px, empat tingkat sudah memakan hampir seluruh lebar,
 * dan tingkat kelima menyisakan kolom teks selebar dua karakter. DATANYA tetap tanpa
 * batas; yang dibatasi hanya jorokannya.
 */
const INDENT_MAKS = 4;

export type KonteksButir = {
  poId: string;
  saya: string;
  bolehTulis: boolean;
  baru: (e: Peristiwa) => boolean;
};

// JANGAN "rapikan" ini dengan mengimpor waktuID dari ./komentar. Berkas itu bertanda
// 'use client', dan NILAI bukan-komponen yang diimpor Server Component dari modul klien
// berubah jadi rujukan klien — nilainya undefined di server, TANPA galat, lalu mati saat
// berjalan. Sudah menggigit lewat PALET di lib/grafik.tsx, dan uji/batas-klien.test.mjs
// ada persis untuk menangkapnya. Menyalin dua baris lebih murah daripada itu.
const waktuID = (w: string) =>
  new Date(w).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function ButirLini(
  { e, tingkat, ctx }: { e: Peristiwa; tingkat: number; ctx: KonteksButir },
) {
  const jorok = Math.min(tingkat, INDENT_MAKS);
  return (
    <li className={tingkat > 0 ? 'lini-balasan' : undefined}
        style={tingkat > 0 ? { marginLeft: jorok * 18 } : undefined}>
      <span className={`lini-titik w-${e.warna}`} aria-hidden="true" />
      <div>
        {e.yatim && (
          <div className="komentar-dihapus lini-rincian">
            Peristiwa yang dibalas sudah tidak ada di lini masa — mungkin tanda tangan
            yang dibatalkan saat PO dikembalikan.
          </div>
        )}
        <div className="lini-judul">
          {e.judul}
          {ctx.baru(e) && <span className="hitung-baru" style={{ marginLeft: 8 }}>baru</span>}
        </div>
        {e.rincian && <div className="lini-rincian">{e.rincian}</div>}
        {e.komentar && (
          <IsiKomentar key={e.komentar.id} poId={ctx.poId} k={e.komentar}
            milik={e.oleh === ctx.saya && ctx.bolehTulis} />
        )}
        <div className="ttd-waktu">
          {e.oleh ? `${e.oleh.split('@')[0]} · ` : ''}{waktuID(e.waktu)}
        </div>
        {ctx.bolehTulis && <KotakBalas poId={ctx.poId} indukKunci={e.kunci} />}
        {e.balasan.length > 0 && (
          <ol className="lini-masa lini-utas">
            {e.balasan.map((b) => (
              <ButirLini key={b.kunci} e={b} tingkat={tingkat + 1} ctx={ctx} />
            ))}
          </ol>
        )}
      </div>
    </li>
  );
}
```

- [ ] **Langkah 4: Pakai di `page.tsx`**

Ganti seluruh blok `<ol className="lini-masa">…</ol>` (baris 279–304) dengan:

```tsx
        {peristiwa.length > 0 && (
          <ol className="lini-masa">
            {peristiwa.map((e: Peristiwa) => (
              <ButirLini key={e.kunci} e={e} tingkat={0} ctx={{
                poId: po.id,
                saya: hasil.pengguna.email,
                bolehTulis: bolehKomentar(hasil.pengguna.peran),
                baru: komentarBaru,
              }} />
            ))}
          </ol>
        )}
```

Tambahkan importnya: `import ButirLini from './butir-lini';`

Butir berkunci `e.kunci` sekarang, bukan `e.komentar?.id ?? …|…|i` — kunci itu sudah unik
per peristiwa dan tidak berpindah saat butir baru muncul di atas. Alasan aslinya tetap
berlaku: tanpa kunci stabil, `state` sunting tertinggal di slotnya dan kotak sunting
terbuka berisi teks komentar ORANG LAIN.

- [ ] **Langkah 5: CSS**

Tambahkan sesudah `.komentar-kotak` di `app/globals.css`:

```css
/* Utas balasan. Indent-nya dari marginLeft di ButirLini, bukan dari sini: tingkatnya
   dihitung di sana dan dipagari INDENT_MAKS. */
.lini-utas{margin:10px 0 0;padding:0}
.lini-utas>li{padding-bottom:12px}
.lini-utas>li:last-child{padding-bottom:0}
.lini-balasan .lini-judul{font-size:13.5px}
.balas-kotak{margin-top:8px;max-width:640px}
```

- [ ] **Langkah 6: Periksa**

```bash
npm run periksa
```

- [ ] **Langkah 7: Lihat dengan mata, dua tema, 375px**

```bash
npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-komentar.tsx
```

Buka `_komentar-terang.html` dan `_komentar-gelap.html` lewat server `pratinjau-statis`
(port 8765 di `~/.claude/launch.json`) di Browser pane. **Chrome tidak ada di Mac ini**,
jadi `uji/tangkap-layar.mjs` mati — andalkan `scrollWidth`/`innerWidth` lewat JS, bukan
tangkapan layar desktop teremulasi yang sering kosong. Periksa: tidak ada gulir mendatar
di 375px, indent berhenti di tingkat 4, nisan terbaca di kedua tema.

- [ ] **Langkah 8: Commit**

```bash
git add "app/(sistem)/po/[id]/komentar.tsx" "app/(sistem)/po/[id]/butir-lini.tsx" "app/(sistem)/po/[id]/page.tsx" app/globals.css
git commit -m "Balasan komentar 5/6: tombol Balas, utas bersarang, nisan

Beberapa kotak balas boleh terbuka bersamaan: menutup yang lain berarti
membuang kalimat yang sudah diketik orang di sana.

Kalimat 'Utas ini satu dan terbuka' diganti — ia terbaca seolah menjanjikan
kedataran, padahal yang dijanjikan catatan/09 adalah tidak ada yang tersembunyi.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Tugas 6: Lencana rekursif dan pratinjau bersarang

**Berkas:**
- Ubah: `app/(sistem)/po/[id]/page.tsx:74-78`
- Ubah: `uji/pratinjau-komentar.tsx`

Ini kegagalan yang **paling mungkin lolos ke produksi tanpa ketahuan**, karena layarnya
tetap tampak benar: balasan baru tidak menyalakan lencana, dan PO tampak sudah terbaca
padahal ada yang menunggu jawaban.

- [ ] **Langkah 1: Buat lencananya menelusuri balasan**

Ganti baris 76–78 di `page.tsx`:

```tsx
  const komentarBaru = (e: Peristiwa) => !!e.komentar && !e.komentar.dihapus && e.oleh !== saya
    && (!dibacaPada || +new Date(e.waktu) > +new Date(dibacaPada));
  // Menelusuri balasan: lencana yang hanya melihat tingkat atas membuat PO tampak sudah
  // terbaca padahal ada balasan baru yang menunggu jawaban.
  const adaBaruDi = (e: Peristiwa): boolean => komentarBaru(e) || e.balasan.some(adaBaruDi);
  const adaBaru = peristiwa.some(adaBaruDi);
```

Pastikan baris `const komentarBaru = ...` yang lama tidak tertinggal ganda.

- [ ] **Langkah 2: Tambahkan utas bersarang ke pratinjau**

Di `uji/pratinjau-komentar.tsx`, tambahkan ke larik `komentar` yang sudah ada:

```tsx
  { id: 'b1', isi: 'Termin keduanya sudah saya perbaiki, mohon dicek lagi.',
    oleh: 'bintang@skolla.education', waktu: w(200), versi_po: 2,
    disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
    induk_kunci: 'verifikasi:finance:' + w(150) },
  { id: 'b2', isi: 'Sudah betul. Saya cabut catatannya.', oleh: saya, waktu: w(210),
    versi_po: 2, disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
    induk_kunci: 'komentar:b1' },
  { id: 'b3', isi: 'Balasan ini menempel ke tanda tangan yang sudah dibatalkan.',
    oleh: saya, waktu: w(220), versi_po: 2,
    disunting_pada: null, dihapus_pada: null, dihapus_oleh: null,
    induk_kunci: 'ttd:kepala_sekolah:2026-01-01T00:00:00.000Z' },
```

Sesuaikan waktu `verifikasi` agar `w(150)` benar-benar cocok dengan keputusan Finance yang
sudah ada di berkas itu — kalau tidak cocok, `b1` akan tampil sebagai nisan dan bukan itu
yang sedang diperiksa. `b3` MEMANG harus jadi nisan; itu keadaan yang diperiksa.

Render `ButirLini`, bukan `<li>` tulisan tangan, supaya yang dilihat mata benar-benar
komponen yang dipakai produksi.

- [ ] **Langkah 3: Render dan lihat**

```bash
npx tsx --tsconfig uji/tsconfig-pratinjau.json uji/pratinjau-komentar.tsx
```

Periksa di dua tema: lencana "baru" muncul pada balasan bersarang, nisan `b3` terbaca,
indent berhenti di tingkat 4.

- [ ] **Langkah 4: Seluruh pemeriksaan**

```bash
npm run periksa && npm run build
```

- [ ] **Langkah 5: Commit**

```bash
git add "app/(sistem)/po/[id]/page.tsx" uji/pratinjau-komentar.tsx
git commit -m "Balasan komentar 6/6: lencana menelusuri balasan, pratinjau bersarang

Lencana yang hanya melihat tingkat atas membuat PO tampak sudah terbaca padahal
ada balasan baru yang menunggu jawaban — dan layarnya tetap tampak benar, jadi
ini kegagalan yang paling mungkin lolos tanpa ketahuan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Sesudah keenam tugas

1. **QA independen wajib**, sebelum merge dan sebelum deploy. Proyek ini tidak terdaftar
   di pipeline orca (`~/Projects/tools/orca-projects.txt`), jadi QA dijalankan lewat
   sub-agen dengan mandat baca-saja: snapshot `git rev-parse HEAD` + `git status
   --porcelain` sebelum mulai, bandingkan sesudahnya sebagai ganti `--qc-guard`.
2. **Perbarui `catatan/20`**: status jadi DIBANGUN, plus bagian "Langkah 1 — apa yang
   benar-benar dibuktikan" berisi hasil pembuktian manual tugas 1 langkah 3.
3. **Deploy produksi lewat `vercel --prod --yes`** dari direktori proyek — proyek Vercel
   ini TIDAK tersambung git, jadi `git push` tidak men-deploy apa pun. Butuh go-ahead
   terpisah dari Rizki.
