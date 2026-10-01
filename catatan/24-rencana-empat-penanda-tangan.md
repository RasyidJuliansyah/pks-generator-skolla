# Rencana: Form PO dengan empat penanda tangan

> **Untuk agen pelaksana:** WAJIB memakai sub-skill superpowers:subagent-driven-development
> (disarankan) atau superpowers:executing-plans untuk menjalankan rencana ini tugas demi tugas.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** PO baru ditandatangani empat pihak (Kepala Sekolah, Partnership Manager, Regional
Head Division, Head of Sales), sementara setiap PO yang sudah ada tetap tiga pihak dan
dokumennya tidak berubah satu bait pun.

**Arsitektur:** Kolom `po.skema_ttd` (3 atau 4) diisi trigger saat PO lahir dan tidak pernah
berubah. Satu fungsi basis data `private.pihak_wajib(skema)` dan cerminnya `pihakUntuk(skema)`
di `lib/pihak.ts` menjadi satu-satunya sumber daftar pihak. Head of Sales tetap bernilai enum
`sales_manager`; hanya labelnya yang mengikuti skema. Peran baru `regional_head` baca-saja,
pola `c_level`.

**Tumpukan:** Next.js 16 App Router, TypeScript, `@supabase/ssr`, Postgres (Supabase
`lzamazdfaidxuohhzpjd`), uji `node --test` di `uji/*.test.mjs`, Docker lewat Colima untuk
basis data lokal.

**Spesifikasi:** `catatan/23-spesifikasi-empat-penanda-tangan.md` (baca dulu, rencana ini
berargumen dari sana).

## Batasan global

- Repo di `~/Projects/Skolla/skolla-kerjasama`, cabang kerja `build/ekstraksi-scan-po`
  (spesifikasi sudah di sana; nama cabang tetap, jangan membuat cabang baru).
- Setiap migrasi baru ditulis di `supabase/migrasi/<tanggal><huruf>_<nama>.sql` **dan** disalin
  byte-identik ke `supabase/migrations/<14 digit>_<nama>.sql` pada commit yang sama
  (`uji/rantai-migrasi.test.mjs` menjaganya).
- **Tidak ada satu pun penulisan ke produksi** (migrasi, data, deploy) sebelum Tugas 9, dan
  Tugas 9 hanya dijalankan sesudah Rizki menyetujui secara eksplisit.
- `ALTER TYPE ... ADD VALUE` harus di migrasi TERPISAH dari pemakaian nilainya.
- Kolom baru di `po` wajib masuk KEDUA tuple `private.bekukan_isi_po`.
- Uji yang membaca migrasi memakai `migrasiTerakhir(pola)` dari `uji/migrasi.mjs`, tidak pernah
  nama berkas yang dipatok.
- Golden lama di `uji/emas/` dan `uji/emas/isi-po-*.json` **tidak boleh berubah**. Selisih
  pada berkas lama = cacat, bukan alasan merekam ulang.
- Label: skema 3 = "Sales Manager", skema 4 = "Head of Sales"; peran `regional_head` berlabel
  "Regional Head Division".
- Teks layar dan dokumen tanpa em dash (`—`, `&mdash;`), sesuai `DESIGN.md`. Pengecualian yang
  sudah ada: `'—'` pengisi nama kosong di `ajukan_po_unggahan` (bukan teks layar baru).
- Pekerjaan tampilan: baca `DESIGN.md`, saring dengan skill antislop.
- Gerbang tiap tugas: `npm run periksa` hijau. Sesudah menghapus rute sementara: hapus `.next`.

## Fokus tinjauan

1. **Draf unggahan yang sudah dinyatakan sesuai pindaian sebelum migrasi** harus tetap bisa
   diajukan tanpa ditinjau ulang: sidik lamanya wajib sama dengan sidik yang dihitung sesudah
   kolom baru ada. (Dipakukan di Tugas 2, probe P9.)
2. **Draf skema 3 yang dibuka lagi sesudah rilis** tidak boleh menuntut Regional Head, tidak
   menampilkan dropdown-nya, dan labelnya tetap "Sales Manager". (Tugas 5 dan 6.)
3. **Tanda tangan ketiga pada PO skema 4** tidak boleh membuat PO tampak lengkap: status tetap
   `menunggu_ttd`, panel menulis "3 dari 4". (Tugas 2 probe P2, Tugas 7.)
4. **Belum ada akun `regional_head`**: halangan yang tampil menyebut bahwa Super Admin perlu
   memberikan peran itu, bukan sekadar "belum dipilih". (Tugas 6.)
5. **Super Admin muncul di dropdown Regional Head** bila `daftar_penanda_tangan` menyaring lewat
   `punya_peran`. Diperiksa, bukan diandaikan. (Tugas 4, langkah 1.)

---

### Tugas 1: Sumber tunggal daftar dan label pihak

**Berkas:**
- Ubah: `lib/pihak.ts`
- Uji: `uji/pihak.test.mjs` (baru)

**Antarmuka:**
- Menghasilkan (dipakai Tugas 3, 5, 6, 7):
  - `type Pihak = 'kepala_sekolah' | 'partnership_manager' | 'regional_head' | 'sales_manager'`
  - `type SkemaTtd = 3 | 4`
  - `SEMUA_PIHAK: Pihak[]` (empat, urut dokumen)
  - `pihakUntuk(skema: SkemaTtd): Pihak[]`
  - `labelPihak(p: Pihak, skema: SkemaTtd): string`
  - `skemaDari(v: unknown): SkemaTtd` (4 hanya bila `v === 4`; selain itu 3, supaya data lama
    tanpa kolom terbaca tiga)
  - `URUT_PIHAK` dan `LABEL_PIHAK` TETAP ada sampai Tugas 7 menghapusnya.

- [ ] **Langkah 1: Tulis uji yang gagal** — `uji/pihak.test.mjs`:

```js
// Satu sumber daftar dan label pihak penanda tangan (catatan/23).
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { SEMUA_PIHAK, pihakUntuk, labelPihak, skemaDari } = muat('pihak');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

assert.deepEqual(pihakUntuk(3), ['kepala_sekolah', 'partnership_manager', 'sales_manager']);
assert.deepEqual(pihakUntuk(4), ['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager']);
assert.deepEqual(SEMUA_PIHAK, pihakUntuk(4));
ok('skema 3 = tiga pihak lama, skema 4 = empat pihak urut dokumen');

// Dokumen yang sudah diteken dirender ulang dengan label yang sama seperti saat diteken.
assert.equal(labelPihak('sales_manager', 3), 'Sales Manager');
assert.equal(labelPihak('sales_manager', 4), 'Head of Sales');
assert.equal(labelPihak('regional_head', 4), 'Regional Head Division');
assert.equal(labelPihak('kepala_sekolah', 3), 'Kepala Sekolah');
assert.equal(labelPihak('partnership_manager', 4), 'Partnership Manager');
ok('label Sales Manager/Head of Sales mengikuti skema');

assert.equal(skemaDari(4), 4);
for (const v of [3, undefined, null, '4', 0, 5]) assert.equal(skemaDari(v), 3, String(v));
ok('skemaDari: hanya angka 4 yang terbaca empat; data lama tanpa kolom terbaca tiga');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/pihak.test.mjs`
Harapan: GAGAL (`pihakUntuk is not a function`).

- [ ] **Langkah 3: Implementasi** — `lib/pihak.ts` menjadi:

```ts
/**
 * Pihak penanda tangan Form Pre Order, dan SATU-SATUNYA sumber daftar serta labelnya di
 * aplikasi. Cerminnya di basis data: private.pihak_wajib(skema) (catatan/23).
 *
 * Head of Sales SENGAJA tetap bernilai `sales_manager`: kotaknya sama, cuma namanya
 * berganti. Tidak ada baris tanda_tangan atau berkas storage yang perlu dipindah. PO
 * skema 3 tetap berlabel "Sales Manager" supaya dokumen yang sudah diteken tidak berubah
 * isi saat dirender ulang.
 */
export type Pihak = 'kepala_sekolah' | 'partnership_manager' | 'regional_head' | 'sales_manager';
export type SkemaTtd = 3 | 4;

export const SEMUA_PIHAK: Pihak[] = ['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager'];

export const pihakUntuk = (skema: SkemaTtd): Pihak[] =>
  skema === 4 ? SEMUA_PIHAK : SEMUA_PIHAK.filter((p) => p !== 'regional_head');

export function labelPihak(p: Pihak, skema: SkemaTtd): string {
  switch (p) {
    case 'kepala_sekolah': return 'Kepala Sekolah';
    case 'partnership_manager': return 'Partnership Manager';
    case 'regional_head': return 'Regional Head Division';
    case 'sales_manager': return skema === 4 ? 'Head of Sales' : 'Sales Manager';
  }
}

/** Nilai kolom po.skema_ttd dari baris mana pun; yang bukan 4 persis terbaca 3. */
export const skemaDari = (v: unknown): SkemaTtd => (v === 4 ? 4 : 3);

/** @deprecated Dihapus di Tugas 7; pakai pihakUntuk(skema). */
export const URUT_PIHAK: Pihak[] = pihakUntuk(3);

/** @deprecated Dihapus di Tugas 7; pakai labelPihak(p, skema). */
export const LABEL_PIHAK: Record<Pihak, string> = {
  kepala_sekolah: 'Kepala Sekolah',
  partnership_manager: 'Partnership Manager',
  regional_head: 'Regional Head Division',
  sales_manager: 'Sales Manager',
};
```

- [ ] **Langkah 4: Jalankan uji + periksa**

Jalankan: `node --test uji/pihak.test.mjs && npm run periksa`
Harapan: LULUS. (`Record<Pihak, string | undefined>` di `panel-ttd.tsx` bisa galat tipe karena
kunci baru; bila demikian ubah tipe prop `nama` di sana menjadi `Partial<Record<Pihak, string>>`
tanpa perubahan lain.)

- [ ] **Langkah 5: Commit**

```bash
git add lib/pihak.ts uji/pihak.test.mjs app/\(sistem\)/po/\[id\]/panel-ttd.tsx
git commit -m "Pihak penanda tangan: satu sumber daftar dan label per skema (catatan/23)"
```

---

### Tugas 2: Migrasi basis data dan buktinya di Postgres lokal

**Berkas:**
- Baru: `supabase/migrasi/20260925_empat_penanda_enum.sql` + salinan identik
  `supabase/migrations/20260925010000_empat_penanda_enum.sql`
- Baru: `supabase/migrasi/20260925b_empat_penanda_tangan.sql` + salinan identik
  `supabase/migrations/20260925020000_empat_penanda_tangan.sql`
- Baru: `uji/db-lokal/siapkan.sh`, `uji/db-lokal/stub.sql`, `uji/db-lokal/bukti-empat-ttd.sql`
- Baru: `uji/empat-ttd-migrasi.test.mjs`
- Ubah: `.gitignore` (tambah `uji/db-lokal/skema.sql`)

**Antarmuka:**
- Menghasilkan (dipakai Tugas 4, 5, 7): kolom `po.skema_ttd smallint not null` (3|4, bawaan 4),
  `po.nama_rh text`; nilai enum `pihak_ttd.regional_head` dan `peran.regional_head`; fungsi
  `private.pihak_wajib(smallint) returns pihak_ttd[]`; `ajukan_po_unggahan` menyisipkan satu
  baris per pihak wajib; trigger INSERT menerima `skema_ttd = 3` hanya dari PO `asal = 'unggahan'`.

- [ ] **Langkah 1: Harness Postgres lokal** — `uji/db-lokal/stub.sql` (skema yang tidak ikut
  dump `public,private` tetapi dirujuk fungsinya):

```sql
-- Stub minimum untuk memuat dump skema public+private di Postgres polos. BUKAN Supabase:
-- hanya cukup untuk membuktikan trigger/RPC/RLS dalam transaksi yang dibatalkan.
do $$ begin
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
exception when duplicate_object then null; end $$;
create schema if not exists auth;
create or replace function auth.jwt() returns jsonb language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create or replace function auth.uid() returns uuid language sql stable as
  $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create schema if not exists storage;
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid,
  version text, metadata jsonb, archived_at timestamptz, created_at timestamptz default now());
create table if not exists storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
grant usage on schema auth, storage to anon, authenticated, service_role;
grant select on storage.objects to authenticated;
create extension if not exists pgcrypto;
```

`uji/db-lokal/siapkan.sh`:

```bash
#!/usr/bin/env bash
# Postgres lokal berisi SKEMA produksi (tanpa data) untuk membuktikan migrasi.
# Pemakaian: uji/db-lokal/siapkan.sh [migrasi.sql ...]   lalu   uji/db-lokal/psql.sh < berkas.sql
set -euo pipefail
cd "$(dirname "$0")"
colima status >/dev/null 2>&1 || colima start
docker rm -f kerjasama-uji >/dev/null 2>&1 || true
docker run -d --name kerjasama-uji -e POSTGRES_PASSWORD=uji -p 55432:5432 postgres:17 >/dev/null
until docker exec kerjasama-uji pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
[ -f skema.sql ] || (cd ../.. && supabase db dump --linked -s public,private -f uji/db-lokal/skema.sql)
psql() { docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
psql < stub.sql
psql < skema.sql
for m in "$@"; do echo "== $m"; psql -1 < "$m"; done
echo "siap: docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
```

Tambah `uji/db-lokal/skema.sql` ke `.gitignore` (skema produksi tidak di-commit; tidak memuat
data, tetapi tidak ada alasan menyimpannya di repo).

Jalankan: `chmod +x uji/db-lokal/siapkan.sh && uji/db-lokal/siapkan.sh`
Harapan: berakhir dengan "siap". Bila `skema.sql` gagal dimuat karena objek Supabase lain
(mis. `extensions.*`, `graphql`), tambahkan stub minimum di `stub.sql` untuk objek yang
disebut pesan galatnya, lalu ulangi. Jangan menyunting `skema.sql`.

- [ ] **Langkah 2: Tulis bukti yang gagal** — `uji/db-lokal/bukti-empat-ttd.sql`. Setiap probe
  berjalan di transaksinya sendiri dan DIBATALKAN; kegagalan asersi = `raise exception`.
  Fikstur disisipkan dengan `session_replication_role = replica` (trigger mati) supaya
  keadaan awal bisa dirakit bebas, lalu trigger dinyalakan lagi sebelum aksi yang diuji.

```sql
\set ON_ERROR_STOP on
-- Pembantu: sesi sebagai pengguna berperan tertentu.
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

-- Pengguna fikstur (sekali, di luar probe; basis data lokal dibuang sesudahnya).
insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('rh@uji', 'RH Uji', '{regional_head}', true),
  ('hos@uji', 'HoS Uji', '{head_of_sales}', true)
on conflict (email) do nothing;
insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh)
  values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji')
on conflict do nothing;

-- P1: PO LAMA (skema 3) maju ke ditandatangani dengan tiga tanda tangan.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 3, 1000, 1, 1000);
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c1', 'kepala_sekolah', 'KS', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c1', 'partnership_manager', 'PM', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c1', 'sales_manager', 'SM', 'x', 'sales@uji');
  set local session_replication_role = origin;
  update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c1';
  do $$ begin raise notice 'P1 OK: skema 3 lolos dengan tiga tanda tangan'; end $$;
rollback;

-- P2: PO BARU (skema 4) ditolak di 3 dari 4, lolos di 4 dari 4.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 4, 1000, 1, 1000);
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c2', 'kepala_sekolah', 'KS', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c2', 'partnership_manager', 'PM', 'x', 'sales@uji'),
    ('00000000-0000-0000-0000-0000000000c2', 'sales_manager', 'HoS', 'x', 'sales@uji');
  set local session_replication_role = origin;
  do $$ begin
    begin
      update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c2';
      raise exception 'P2 GAGAL: skema 4 lolos dengan tiga tanda tangan';
    exception when check_violation then
      if sqlerrm not like '%3 dari 4%' then raise exception 'P2 GAGAL: pesan tak menyebut 3 dari 4: %', sqlerrm; end if;
    end;
  end $$;
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh) values
    ('00000000-0000-0000-0000-0000000000c2', 'regional_head', 'RH', 'x', 'sales@uji');
  update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000c2';
  do $$ begin raise notice 'P2 OK: 3/4 ditolak, 4/4 lolos'; end $$;
rollback;

-- P3: skema tidak bisa diubah lewat PostgREST oleh Sales, ke arah mana pun.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'draf', 'platform', 4, 1000, 1, 1000),
           ('00000000-0000-0000-0000-000000000c3b', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'draf', 'platform', 3, 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    begin update po set skema_ttd = 3 where id = '00000000-0000-0000-0000-0000000000c3';
      raise exception 'P3 GAGAL: 4 -> 3 lolos';
    exception when check_violation then null; end;
    begin update po set skema_ttd = 4 where id = '00000000-0000-0000-0000-000000000c3b';
      raise exception 'P3 GAGAL: 3 -> 4 lolos';
    exception when check_violation then null; end;
    raise notice 'P3 OK: skema beku sejak lahir';
  end $$;
rollback;

-- P4: PO platform tidak bisa lahir skema 3; PO unggahan boleh (centang form lama).
begin;
  select pg_temp.sebagai('sales@uji');
  insert into po (id, sekolah_id, dibuat_oleh, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c4', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'platform', 3, 0, 0, 0),
           ('00000000-0000-0000-0000-000000000c4b', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'unggahan', 3, 0, 0, 0),
           ('00000000-0000-0000-0000-000000000c4c', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'unggahan', 4, 0, 0, 0);
  do $$ declare a int; b int; c int; begin
    select skema_ttd into a from po where id = '00000000-0000-0000-0000-0000000000c4';
    select skema_ttd into b from po where id = '00000000-0000-0000-0000-000000000c4b';
    select skema_ttd into c from po where id = '00000000-0000-0000-0000-000000000c4c';
    if (a, b, c) is distinct from (4, 3, 4) then raise exception 'P4 GAGAL: % % %', a, b, c; end if;
    raise notice 'P4 OK: platform selalu 4, unggahan boleh 3';
  end $$;
rollback;

-- P5: nama_rh kosong menahan PO skema 4 keluar draf; PO skema 3 tidak menuntutnya.
-- Keluar draf memicu syarat lain (termin, masa aktif, isian sekolah); fikstur memenuhi semuanya.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, versi_iom, sekolah_beku, nama_pm, nama_sm)
    select v.id::uuid, '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'platform', v.skema, 1000, 1, 1000,
           '2026-10-01', '2027-09-30', null,
           '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb, 'PM', 'HoS'
      from (values ('00000000-0000-0000-0000-0000000000c5', 4), ('00000000-0000-0000-0000-000000000c5b', 3)) v(id, skema);
  insert into po_termin (po_id, urutan, nominal, tanggal) values
    ('00000000-0000-0000-0000-0000000000c5', 1, 1000, '2026-10-15'),
    ('00000000-0000-0000-0000-000000000c5b', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  do $$ begin
    begin update po set status = 'menunggu_ttd' where id = '00000000-0000-0000-0000-0000000000c5';
      raise exception 'P5 GAGAL: skema 4 tanpa Regional Head keluar draf';
    exception when check_violation then
      if sqlerrm not like '%Regional Head Division belum dipilih%' then raise exception 'P5 GAGAL: %', sqlerrm; end if;
    end;
    update po set status = 'menunggu_ttd' where id = '00000000-0000-0000-0000-000000000c5b';
    raise notice 'P5 OK: Regional Head wajib hanya di skema 4';
  end $$;
rollback;

-- P6: nama_rh dan skema_ttd beku pada PO yang sudah diteken.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, nama_rh, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c6', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'ditandatangani', 'platform', 4, 'RH Uji', 1000, 1, 1000);
  set local session_replication_role = origin;
  do $$ begin
    begin update po set nama_rh = 'Orang Lain' where id = '00000000-0000-0000-0000-0000000000c6';
      raise exception 'P6 GAGAL: nama_rh berubah pada PO diteken';
    exception when others then
      if sqlerrm like 'P6 GAGAL%' then raise; end if;
    end;
    raise notice 'P6 OK: nama_rh beku';
  end $$;
rollback;

-- P7: ajukan_po_unggahan menyisipkan empat penanda pada skema 4 dan tiga pada skema 3.
-- (Skema 3 dan 4 dibuktikan dalam dua transaksi; fikstur memenuhi syarat keluar draf dan sidik.)
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, sekolah_beku, nama_pm, nama_sm, nama_rh, berkas_unggahan)
    values ('00000000-0000-0000-0000-0000000000c7', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan', 4,
            1000, 1, 1000, '2026-10-01', '2027-09-30',
            '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb,
            'PM', 'HoS', 'RH Uji', '00000000-0000-0000-0000-0000000000c7/po.pdf');
  insert into po_termin (po_id, urutan, nominal, tanggal) values ('00000000-0000-0000-0000-0000000000c7', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  update po set ditinjau_pada = now(), ditinjau_oleh = 'sales@uji' where id = '00000000-0000-0000-0000-0000000000c7';
  select pg_temp.sebagai('sales@uji');
  select ajukan_po_unggahan('00000000-0000-0000-0000-0000000000c7');
  do $$ declare daftar text; begin
    select string_agg(pihak::text || '=' || nama, ',' order by pihak) into daftar
      from tanda_tangan where po_id = '00000000-0000-0000-0000-0000000000c7';
    if daftar is distinct from 'kepala_sekolah=KS,partnership_manager=PM,regional_head=RH Uji,sales_manager=HoS' then
      raise exception 'P7 GAGAL: %', daftar; end if;
    raise notice 'P7 OK: unggahan skema 4 = empat penanda';
  end $$;
rollback;
-- P7b: sama, skema 3 dan tanpa nama_rh -> tiga penanda.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa,
                  masa_mulai, masa_selesai, sekolah_beku, nama_pm, nama_sm, berkas_unggahan)
    values ('00000000-0000-0000-0000-000000000c7b', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan', 3,
            1000, 1, 1000, '2026-10-01', '2027-09-30',
            '{"npsn":"1","kepala_sekolah":"KS","kepsek_hp":"1","bendahara":"B","bendahara_hp":"1"}'::jsonb,
            'PM', 'SM', '00000000-0000-0000-0000-000000000c7b/po.pdf');
  insert into po_termin (po_id, urutan, nominal, tanggal) values ('00000000-0000-0000-0000-000000000c7b', 1, 1000, '2026-10-15');
  set local session_replication_role = origin;
  update po set ditinjau_pada = now(), ditinjau_oleh = 'sales@uji' where id = '00000000-0000-0000-0000-000000000c7b';
  select pg_temp.sebagai('sales@uji');
  select ajukan_po_unggahan('00000000-0000-0000-0000-000000000c7b');
  do $$ declare n int; begin
    select count(*) into n from tanda_tangan where po_id = '00000000-0000-0000-0000-000000000c7b';
    if n <> 3 then raise exception 'P7b GAGAL: % penanda', n; end if;
    raise notice 'P7b OK: unggahan skema 3 = tiga penanda';
  end $$;
rollback;

-- P8: akun yang hanya berperan regional_head melihat semua PO dan harga Acquisition,
-- dan ditolak di jalur tulis.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, skema_ttd, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000c8', '00000000-0000-0000-0000-00000000a001', 'sales@uji',
            'menunggu_ttd', 'platform', 4, 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('rh@uji');
  do $$ declare n int; begin
    select count(*) into n from po where id = '00000000-0000-0000-0000-0000000000c8';
    if n <> 1 then raise exception 'P8 GAGAL: regional_head tidak melihat PO'; end if;
    if not private.boleh_lihat_acquisition() then raise exception 'P8 GAGAL: tidak melihat Acquisition'; end if;
    update po set kota = 'X' where id = '00000000-0000-0000-0000-0000000000c8';
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'P8 GAGAL: regional_head menyunting PO'; end if;
    begin
      insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh)
        values ('00000000-0000-0000-0000-0000000000c8', 'regional_head', 'RH', 'x', 'rh@uji');
      raise exception 'P8 GAGAL: regional_head membubuhkan tanda tangan';
    exception when insufficient_privilege then null; end;
    begin
      insert into po (sekolah_id, dibuat_oleh, asal) values ('00000000-0000-0000-0000-00000000a001', 'rh@uji', 'platform');
      raise exception 'P8 GAGAL: regional_head membuat PO';
    exception when insufficient_privilege then null; end;
    raise notice 'P8 OK: regional_head baca-saja, termasuk Acquisition';
  end $$;
rollback;

-- P9: sidik draf unggahan yang sudah ditinjau TIDAK berubah karena kolom baru.
-- Dijalankan siapkan.sh DUA KALI: sekali tanpa migrasi 20260925b (mencatat sidik ke
-- /tmp di dalam container), sekali dengan (membandingkan). Lihat langkah 5.
```

Probe P9 berada di berkas terpisah `uji/db-lokal/bukti-sidik.sql`:

```sql
\set ON_ERROR_STOP on
-- Mode ditentukan variabel psql :mode = 'catat' | 'banding'.
create table if not exists sidik_pembanding (id uuid primary key, sidik text);
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa,
                  kota, nama_pm, nama_sm, berkas_unggahan)
    values ('00000000-0000-0000-0000-0000000000c9', '00000000-0000-0000-0000-00000000a001', 'sales@uji', 'draf', 'unggahan',
            1000, 1, 1000, 'Bekasi', 'PM', 'SM', '00000000-0000-0000-0000-0000000000c9/po.pdf')
    on conflict (id) do nothing;
commit;
\if :{?mode}
\else
\set mode catat
\endif
select (:'mode' = 'catat') as catat \gset
\if :catat
  insert into sidik_pembanding select id, private.sidik_tinjauan(p) from po p
    where id = '00000000-0000-0000-0000-0000000000c9'
    on conflict (id) do update set sidik = excluded.sidik;
  \echo 'P9 dicatat'
\else
  do $$ declare lama text; baru text; begin
    select sidik into lama from sidik_pembanding where id = '00000000-0000-0000-0000-0000000000c9';
    select private.sidik_tinjauan(p) into baru from po p where id = '00000000-0000-0000-0000-0000000000c9';
    if lama is distinct from baru then raise exception 'P9 GAGAL: sidik berubah karena kolom baru'; end if;
    raise notice 'P9 OK: sidik draf lama tetap';
  end $$;
\endif
```

- [ ] **Langkah 3: Jalankan bukti tanpa migrasi, pastikan gagal**

```bash
uji/db-lokal/siapkan.sh
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 < uji/db-lokal/bukti-empat-ttd.sql
```
Harapan: GAGAL di fikstur (`invalid input value for enum peran: "regional_head"` atau kolom
`skema_ttd` tidak ada).

- [ ] **Langkah 4: Tulis migrasi A** — `supabase/migrasi/20260925_empat_penanda_enum.sql`,
  lalu `cp` ke `supabase/migrations/20260925010000_empat_penanda_enum.sql`:

```sql
-- Empat penanda tangan Form PO, bagian 1: nilai enum (catatan/23).
--
-- TERPISAH dari pemakaiannya karena nilai enum baru tidak bisa dipakai di transaksi yang
-- sama dengan penambahannya. Aditif: tidak ada baris yang berubah, dan nilai yang belum
-- dipakai tidak mengubah perilaku apa pun.
--
-- `regional_head` di pihak_ttd: kotak baru di antara Partnership Manager dan Head of Sales.
-- Head of Sales TIDAK mendapat nilai baru; ia tetap `sales_manager`, hanya labelnya berganti
-- di aplikasi (lib/pihak.ts), supaya tidak ada tanda tangan atau berkas yang dipindah.
alter type pihak_ttd add value if not exists 'regional_head' after 'partnership_manager';

-- Peran Regional Head Division: baca-saja pola c_level, diberikan lewat Kelola Pengguna.
alter type peran add value if not exists 'regional_head';
```

- [ ] **Langkah 5: Tulis migrasi B** — `supabase/migrasi/20260925b_empat_penanda_tangan.sql`,
  lalu `cp` ke `supabase/migrations/20260925020000_empat_penanda_tangan.sql`:

```sql
-- Empat penanda tangan Form PO, bagian 2 (catatan/23, keputusan Rizki 25 Sep 2026).
--
-- Hanya PO BARU yang butuh empat. Setiap PO yang ada saat migrasi ini berjalan tetap tiga,
-- dan dokumennya tidak berubah: po.skema_ttd dicatat per PO, diisi saat lahir, tidak
-- pernah berubah sesudahnya.

-- 1. Kolom. Bawaan 3 SAAT DITAMBAHKAN = backfill semua PO lama dalam satu langkah, tanpa
-- UPDATE yang memicu trigger. Sesudah itu bawaannya 4, dan trigger INSERT yang menentukan.
alter table po add column if not exists skema_ttd smallint not null default 3
  check (skema_ttd in (3, 4));
alter table po alter column skema_ttd set default 4;
comment on column po.skema_ttd is
  'Jumlah penanda tangan Form PO: 3 (Kepala Sekolah, PM, Sales Manager) untuk PO sebelum 25 Sep 2026 '
  'dan unggahan form kertas lama; 4 (+ Regional Head Division, Sales Manager berlabel Head of Sales) '
  'untuk yang lain. Diisi private.jaga_syarat_maju saat INSERT, tidak bisa diubah sesudahnya.';

alter table po add column if not exists nama_rh text;
comment on column po.nama_rh is
  'Regional Head Division yang menandatangani, dipilih dari akun berperan regional_head. Hanya bermakna pada skema_ttd = 4.';

-- 2. Daftar pihak per skema: SATU sumber di basis data. Cerminnya lib/pihak.ts pihakUntuk().
create or replace function private.pihak_wajib(p_skema smallint)
returns pihak_ttd[] language sql immutable set search_path = public as $$
  select case when p_skema = 4
    then array['kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager']::pihak_ttd[]
    else array['kepala_sekolah', 'partnership_manager', 'sales_manager']::pihak_ttd[] end;
$$;
revoke all on function private.pihak_wajib(smallint) from public, anon, authenticated;

-- 3. Syarat maju: skema ditentukan saat lahir dan beku; Regional Head wajib keluar draf.
-- Ditulis di atas versi 20260920a (nilai sponsorship); seluruh isinya dipertahankan.
create or replace function private.jaga_syarat_maju()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_kurang text[] := '{}';
  v_n int;
  v_total bigint;
  v_ada_catatan boolean;
  r record;
begin
  if tg_op = 'INSERT' then
    new.versi_iom := private.versi_iom_berlaku();
    -- Tiga kotak hanya untuk form kertas lama yang diunggah (centang di langkah 0). PO
    -- platform selalu empat, apa pun kiriman klien.
    new.skema_ttd := case when new.asal = 'unggahan' and new.skema_ttd = 3 then 3 else 4 end;
    return new;
  end if;

  -- Tanpa ini Sales bisa mengosongkan stempel lewat PostgREST dan PO-nya lolos dari
  -- syarat B sebagai "PO lama".
  if new.versi_iom is distinct from old.versi_iom then
    raise exception 'Versi IoM sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
  end if;

  -- Sama alasannya: PO skema 4 yang diturunkan jadi 3 lolos dengan tiga tanda tangan.
  if new.skema_ttd is distinct from old.skema_ttd then
    raise exception 'Jumlah penanda tangan sebuah PO tidak bisa diubah.' using errcode = 'check_violation';
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

  -- Keputusan C (catatan/18): catatan dan nilai sponsorship wajib berpasangan.
  -- Hanya PO berstempel versi yang berlaku sekarang.
  if new.versi_iom = private.versi_iom_berlaku() then
    select exists (select 1 from po_catatan
                   where po_id = new.id and jenis = 'sponsorship'
                     and btrim(coalesce(isi, '')) <> '')
      into v_ada_catatan;
    if v_ada_catatan and coalesce(new.nilai_sponsorship, 0) = 0 then
      v_kurang := array_append(v_kurang, 'Catatan sponsorship sudah diisi, tapi nilainya belum.');
    end if;
    if coalesce(new.nilai_sponsorship, 0) > 0 and not v_ada_catatan then
      v_kurang := array_append(v_kurang, 'Nilai sponsorship sudah diisi, tapi catatannya belum.');
    end if;
  end if;

  -- Keputusan D (catatan/23): PO empat penanda tangan butuh nama Regional Head.
  if new.skema_ttd = 4 and coalesce(btrim(new.nama_rh), '') = '' then
    v_kurang := array_append(v_kurang, 'Regional Head Division belum dipilih.');
  end if;

  if cardinality(v_kurang) > 0 then
    raise exception 'PO belum bisa dikirim: %', array_to_string(v_kurang, ' ')
      using errcode = 'check_violation';
  end if;
  return new;
end $function$;

-- 4. Pembekuan: DAFTAR KOLOM EKSPLISIT, kedua tuple. Kolom baru tidak ikut beku sendirinya.
create or replace function private.bekukan_isi_po()
 returns trigger
 language plpgsql
 set search_path to 'public'
as $function$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor,
      NEW.asal, NEW.berkas_unggahan, NEW.ditinjau_pada, NEW.ditinjau_oleh,
      NEW.permintaan_tambahan, NEW.versi_iom, NEW.nilai_sponsorship,
      NEW.skema_ttd, NEW.nama_rh)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;

-- 5. Urutan status: "semua pihak wajib sudah ada", bukan "tiga baris".
-- Ditulis di atas versi 20260917d; hanya dua pemeriksaan jumlah yang berganti.
create or replace function private.jaga_urutan_status_po()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v_ada int; v_wajib int;
begin
  if new.status is not distinct from old.status then return new; end if;

  -- Putaran tanda tangan baru (temuan QA putaran 2): isi PO dibekukan saat keluar draf, jadi
  -- tanda tangan dari putaran sebelumnya (PO yang ditolak lalu disunting) bukan tanda tangan
  -- atas isi yang sekarang. Pola yang sama dengan kembalikanKeDraf dan ajukan_po_unggahan.
  -- Trigger ini berjalan paling akhir, jadi penghapusan tidak terjadi bila trigger lain menolak.
  if new.status = 'menunggu_ttd' and old.status in ('draf', 'ditolak') then
    delete from tanda_tangan where po_id = new.id;
    return new;
  end if;

  v_wajib := cardinality(private.pihak_wajib(new.skema_ttd));
  select count(distinct t.pihak) into v_ada from tanda_tangan t
   where t.po_id = new.id and t.pihak = any (private.pihak_wajib(new.skema_ttd));

  if new.status = 'ditandatangani' then
    if old.status = 'menunggu_ttd' and new.asal = 'platform' then
      -- Hanya PO platform: tanda tangannya dibubuhkan di aplikasi selama menunggu_ttd.
      if v_ada < v_wajib then
        raise exception 'PO baru bisa berstatus ditandatangani sesudah semua pihak menandatangani (% dari %).', v_ada, v_wajib
          using errcode = 'check_violation';
      end if;
      return new;
    elsif old.status in ('draf', 'ditolak') and new.asal = 'unggahan' then
      -- Syarat ajukan_po_unggahan diulang di sini, supaya UPDATE langsung tidak melewatinya.
      -- Sidik dibandingkan dengan baris sesudah trigger lain berjalan (nama trigger ini
      -- sesudah po_tinjauan_sidik dan po_bekukan_sekolah menurut abjad), sama seperti RPC.
      -- PO unggahan TIDAK boleh lewat menunggu_ttd: di sana tanda tangan bisa disisipkan tanpa
      -- pemeriksaan sidik (temuan QA putaran 2).
      if new.berkas_unggahan is null or new.ditinjau_pada is null
         or private.sidik_tinjauan(new) is distinct from new.ditinjau_sidik then
        raise exception 'PO unggahan hanya bisa berstatus ditandatangani lewat pengajuan pindaian yang sudah dinyatakan sesuai.'
          using errcode = 'check_violation';
      end if;
      -- Tanda tangan pindaian putaran lama dibuang; RPC menyisipkan yang baru sesudah lompatan ini.
      delete from tanda_tangan where po_id = new.id;
      return new;
    end if;
    raise exception 'PO berstatus % tidak bisa langsung menjadi ditandatangani.', old.status
      using errcode = 'check_violation';
  end if;

  if new.status = 'verifikasi' then
    if old.status <> 'ditandatangani' or v_ada < v_wajib then
      raise exception 'PO hanya bisa diajukan ke verifikasi sesudah ditandatangani semua pihak (% dari %).', v_ada, v_wajib
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end $$;

-- 6. Sidik tinjauan PO unggahan. Kolom baru SENGAJA dikeluarkan bila tidak membawa isi:
-- sidik adalah hash to_jsonb(baris), jadi kunci baru yang muncul di setiap baris akan
-- membasikan setiap draf unggahan yang sudah dinyatakan sesuai pindaian, dan Sales harus
-- meninjau ulang tanpa ada yang berubah (probe P9). skema_ttd tidak pernah berubah sesudah
-- lahir, jadi tidak perlu disidik; nama_rh disidik begitu terisi, karena itulah isi yang
-- dinyatakan sesuai dengan kertasnya. Ditulis di atas versi 20260922c.
create or replace function private.sidik_tinjauan(p po)
returns text
language sql
stable
security definer
set search_path to public
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'po', (to_jsonb(p) - array['nomor', 'status', 'versi', 'dibuat_oleh', 'dibuat_pada',
                               'diubah_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
                               'diverifikasi_otomatis', 'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik',
                               'skema_ttd'])
          - case when p.nama_rh is null then 'nama_rh' else '' end,
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'kelompok', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_kelompok x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;
revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;

-- 7. Pengajuan PO unggahan: satu penanda per pihak wajib. Ditulis di atas versi 20260911b;
-- seluruh pemeriksaan dan urutannya dipertahankan, hanya penyisipan di akhir yang berganti.
create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po    po%rowtype;
  v_beku  jsonb;
  v_basi  boolean;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if lower(v_po.dibuat_oleh) is distinct from v_saya
     and not private.punya_peran('head_of_sales', 'admin_sales') then
    raise exception 'PO ini bukan milikmu.' using errcode = 'check_violation';
  end if;

  if v_po.asal <> 'unggahan' then
    raise exception 'Jalur ini hanya untuk PO unggahan. PO platform mengumpulkan tanda tangan lewat aplikasi.'
      using errcode = 'check_violation';
  end if;

  if v_po.status not in ('draf', 'ditolak') then
    raise exception 'PO berstatus % sudah tidak bisa diajukan lagi.', v_po.status
      using errcode = 'check_violation';
  end if;

  if v_po.berkas_unggahan is null then
    raise exception 'Pindaian PO belum diunggah.' using errcode = 'check_violation';
  end if;

  -- Tanpa pernyataan Sales, tidak ada yang menjamin data di sistem mewakili kertasnya.
  if v_po.ditinjau_pada is null then
    raise exception 'Belum ada pernyataan bahwa data ini sesuai dengan pindaian.'
      using errcode = 'check_violation';
  end if;

  -- PO yang pernah ditolak lalu diajukan ulang tidak boleh menumpuk tanda tangan.
  delete from tanda_tangan where po_id = p_po;

  -- Lompatan status ini memicu `jaga_lantai_po`; gerbangnya sama dengan jalur platform.
  -- Ia juga menyegarkan sekolah_beku untuk terakhir kalinya; nama kepala sekolah di
  -- tanda tangan harus diambil dari salinan hasil penyegaran ini, bukan dari v_po.
  update po set status = 'ditandatangani' where id = p_po
  returning sekolah_beku, private.sidik_tinjauan(po) is distinct from ditinjau_sidik
  into v_beku, v_basi;

  -- Sidiknya dihitung dari baris hasil lompatan status di atas, jadi yang dibandingkan
  -- persis isi yang dibekukan. Galat membatalkan seluruh pengajuan, termasuk
  -- penghapusan tanda tangan di atas.
  if v_basi then
    raise exception 'Data PO ini berubah sejak dinyatakan sesuai dengan pindaian. Buka Sunting, periksa lagi terhadap pindaiannya, lalu centang pernyataannya.'
      using errcode = 'check_violation';
  end if;

  -- Semuanya menunjuk BERKAS YANG SAMA: satu lembar pindaian. Daftarnya dari skema PO.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal)
  select p_po, w.p,
         coalesce(nullif(btrim(case w.p
           when 'kepala_sekolah' then v_beku->>'kepala_sekolah'
           when 'partnership_manager' then v_po.nama_pm
           when 'regional_head' then v_po.nama_rh
           else v_po.nama_sm end), ''), '—'),
         v_po.berkas_unggahan, v_saya, 'pindaian'
    from unnest(private.pihak_wajib(v_po.skema_ttd)) as w(p);
end;
$$;

-- 8. Regional Head Division: baca-saja pola c_level (keputusan Rizki 25 Sep 2026).
-- Disebut HANYA di dua fungsi pembacaan ini. Setiap jalur tulis menyebut perannya eksplisit,
-- jadi peran yang tidak disebut di sana otomatis tidak bisa menulis.
create or replace function private.boleh_lihat_semua() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran(
    'head_of_sales', 'head_of_operations', 'cbo', 'c_level', 'admin_utama', 'admin_sales',
    'education', 'tech_ops', 'finance', 'service_account', 'tech_ops_lead', 'regional_head'
  );
$fn$;

-- Harga Acquisition ikut terlihat, sama seperti C Level: disengaja. Kalau tidak dikehendaki,
-- cabut 'regional_head' dari baris di bawah, satu kata, dan tidak ada yang lain ikut berubah.
create or replace function private.boleh_lihat_acquisition() returns boolean
language sql stable set search_path to 'public' as $fn$
  select private.punya_peran('cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance', 'regional_head');
$fn$;
```

Sebelum menulis bagian 8, periksa hak eksekusi dan tanda tangan kedua fungsi itu di migrasi
`20260829022532_amankan_fungsi_pembantu.sql` dan `20260830051131_c_level_hanya_melihat.sql`;
`create or replace` mempertahankan grant yang ada, jadi tidak perlu grant ulang. Bila
`punya_peran` menerima `variadic peran[]`, literal `'regional_head'` hanya sah sesudah
migrasi A, dan itulah sebabnya A dan B terpisah.

- [ ] **Langkah 6: Jalankan bukti dengan kedua migrasi, pastikan lulus**

```bash
uji/db-lokal/siapkan.sh   # tanpa migrasi, untuk P9 catat
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -v mode=catat < uji/db-lokal/bukti-sidik.sql
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/20260925010000_empat_penanda_enum.sql
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -1 < supabase/migrations/20260925020000_empat_penanda_tangan.sql
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 -v mode=banding < uji/db-lokal/bukti-sidik.sql
docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1 < uji/db-lokal/bukti-empat-ttd.sql
```

Harapan: NOTICE `P1 OK` sampai `P9 OK`, tanpa `GAGAL`. Fikstur yang ditolak trigger lain yang
tidak terkait (mis. `jaga_lantai_po` karena harga di bawah lantai, atau kolom NOT NULL yang
belum disebut) diperbaiki DI FIKSTUR, dengan menyebutkan nilai yang sah; asersi probe tidak
boleh dilonggarkan. Bila galat menyebut `insufficient_privilege` di tempat yang diharapkan
`check_violation` (atau sebaliknya), baca kebijakan RLS terkait dulu, lalu sesuaikan kelas
galat yang ditangkap dan catat alasannya sebagai komentar di probe.

- [ ] **Langkah 7: Uji statis migrasi** — `uji/empat-ttd-migrasi.test.mjs`:

```js
// Migrasi empat penanda tangan (catatan/23): penjaga yang membaca migrasi TERAKHIR.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';
import { muat } from './muat.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const beku = migrasiTerakhir(/function private\.bekukan_isi_po/).isi
  .split('function private.bekukan_isi_po').pop();
const tuple = beku.split('is distinct from');
assert.ok(tuple.length >= 2, 'bekukan_isi_po tidak berbentuk tuple is distinct from tuple');
for (const kolom of ['skema_ttd', 'nama_rh']) {
  assert.match(tuple[0], new RegExp(`NEW\\.${kolom}\\b`), `${kolom} tidak ada di tuple NEW`);
  assert.match(tuple[1], new RegExp(`OLD\\.${kolom}\\b`), `${kolom} tidak ada di tuple OLD`);
}
ok('skema_ttd dan nama_rh beku di kedua tuple bekukan_isi_po');

const lihat = migrasiTerakhir(/function private\.boleh_lihat_semua/).isi;
assert.match(lihat.split('function private.boleh_lihat_semua').pop().split('$fn$;')[0], /'regional_head'/);
const acq = migrasiTerakhir(/function private\.boleh_lihat_acquisition/).isi;
assert.match(acq.split('function private.boleh_lihat_acquisition').pop().split('$fn$;')[0], /'regional_head'/);
ok('regional_head di kedua fungsi pembacaan');

// Daftar pihak di basis data = cerminnya di TS, urutan termasuk.
const { pihakUntuk } = muat('pihak');
const wajib = migrasiTerakhir(/function private\.pihak_wajib/).isi;
const larik = [...wajib.matchAll(/array\[([^\]]+)\]::pihak_ttd\[\]/g)]
  .map((m) => m[1].split(',').map((s) => s.trim().replace(/'/g, '')));
assert.deepEqual(larik, [pihakUntuk(4), pihakUntuk(3)], 'private.pihak_wajib menyimpang dari lib/pihak.ts');
ok('private.pihak_wajib cermin persis pihakUntuk');

// Tidak ada lagi hitungan "3" harfiah di penjaga urutan status.
const urutan = migrasiTerakhir(/function private\.jaga_urutan_status_po/).isi
  .split('function private.jaga_urutan_status_po').pop();
assert.doesNotMatch(urutan, /<\s*3\b/, 'jaga_urutan_status_po masih membandingkan dengan 3 harfiah');
assert.match(urutan, /pihak_wajib\(new\.skema_ttd\)/);
ok('urutan status membaca pihak wajib dari skema PO');

// Pengajuan unggahan tidak lagi menyebut tiga pihak harfiah.
const aju = migrasiTerakhir(/function ajukan_po_unggahan/).isi.split('function ajukan_po_unggahan').pop();
assert.match(aju, /unnest\(private\.pihak_wajib\(v_po\.skema_ttd\)\)/);
ok('ajukan_po_unggahan menyisipkan penanda dari skema PO');

console.log(`\n${n} pemeriksaan lolos.`);
```

`uji/migrasi.mjs` membaca `supabase/migrasi/`, jadi uji ini membaca salinan catatan; salinan
rantai dijaga identik oleh `uji/rantai-migrasi.test.mjs`.

Jalankan: `node --test uji/empat-ttd-migrasi.test.mjs uji/rantai-migrasi.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 8: Matikan container dan commit**

```bash
docker rm -f kerjasama-uji
git add supabase/migrasi/20260925_empat_penanda_enum.sql supabase/migrasi/20260925b_empat_penanda_tangan.sql \
  supabase/migrations/20260925010000_empat_penanda_enum.sql supabase/migrations/20260925020000_empat_penanda_tangan.sql \
  uji/db-lokal/siapkan.sh uji/db-lokal/stub.sql uji/db-lokal/bukti-empat-ttd.sql uji/db-lokal/bukti-sidik.sql \
  uji/empat-ttd-migrasi.test.mjs .gitignore
git commit -m "Migrasi empat penanda tangan: skema_ttd per PO, Regional Head baca-saja (belum diterapkan)"
```

---

### Tugas 3: Form PO halaman 2 dengan empat kotak

**Berkas:**
- Ubah: `lib/dokumen-po.ts` (tipe `DataDokumen`, tabel `po-ttd`)
- Ubah: `lib/dokumen-dari-po.ts` (`BarisPo`, `dataDokumenDariPo`)
- Ubah: `app/globals.css` (lebar kolom `.po-ttd.empat`)
- Ubah: `uji/emas.test.mjs` (fikstur baru `sma-empat-ttd`)
- Baru: `uji/emas/sma-empat-ttd.{po,surat,pks}.html`, `uji/emas/sma-empat-ttd.harga.json`

**Antarmuka:**
- Mengonsumsi: `pihakUntuk`, `labelPihak`, `skemaDari`, `type Pihak`, `type SkemaTtd` (Tugas 1).
- Menghasilkan: `DataDokumen.skemaTtd?: SkemaTtd`, `DataDokumen.namaRh?: string`,
  `DataDokumen.ttd?: Partial<Record<Pihak, string>>`; `BarisPo.skema_ttd?: number | null`,
  `BarisPo.nama_rh?: string | null`.

- [ ] **Langkah 1: Tulis uji yang gagal** — di `uji/emas.test.mjs`, tambahkan ke `FIXTURE`
  (sesudah `smp-paket-custom`):

```js
  // Empat penanda tangan (catatan/23): Sales Manager berlabel Head of Sales, Regional Head
  // di antara PM dan Head of Sales. Fikstur lain TIDAK punya skema_ttd dan harus tetap
  // tercetak tiga kotak persis seperti rekamannya.
  'sma-empat-ttd': {
    sekolah: { nama: 'SMA SANTAMARIA MONICA', jenjang: 'SMA', kepala_sekolah: 'Dra. Maria Uji',
      alamat: 'Jl. Uji No. 1, Bekasi', telepon: '0800-0000-0001' },
    jumlah_siswa: 300, jumlah_guru: 0, harga_siswa: 350000, harga_guru: 0,
    masa_mulai: '2026-10-01', masa_selesai: '2027-09-30',
    sumber_dana: 'BOS', sumber_dana_lain: null, kota: 'Bekasi', tanggal_ttd: '2026-09-25',
    jumlah_rombel: 1, nama_pm: 'Bintang Uji', nama_sm: 'Agung Uji',
    skema_ttd: 4, nama_rh: 'Teuku Zhurry Ariyandi Putra Uji',
    po_komponen: juara.ids.map((id) => ({ komponen_id: id, sesi: 1 })),
    po_rombel: rombel([10, 11, 12], ['A'], 100),
    po_termin: termin(35_000_000, 3),
    po_catatan: [{ jenis: 'pelaksanaan', isi: 'Mulai semester ganjil.' }],
  },
```

Nama RH sengaja panjang: ia yang membuktikan empat kolom tetap membungkus di A4.

Jalankan: `node --test uji/emas.test.mjs`
Harapan: GAGAL (`ENOENT ... sma-empat-ttd.po.html`).

- [ ] **Langkah 2: Implementasi `lib/dokumen-po.ts`**

Di `DataDokumen`, ganti baris `namaSm?: string;` dan tipe `ttd` menjadi:

```ts
  namaSm?: string;
  /**
   * Hanya PO empat penanda tangan (catatan/23). Tanpa ini, seluruh PO lama dan PO skema 3,
   * halaman 2 tercetak persis seperti sebelumnya; dijaga uji/emas.test.mjs byte per byte.
   */
  skemaTtd?: SkemaTtd;
  /** Regional Head Division; hanya dibaca bila skemaTtd = 4. */
  namaRh?: string;
  /** URL gambar tanda tangan per pihak, bila sudah dibubuhkan. */
  ttd?: Partial<Record<Pihak, string>>;
```

Tambahkan di atas berkas: `import { pihakUntuk, labelPihak, type Pihak, type SkemaTtd } from './pihak';`

Ganti tabel halaman 2 (blok `<table class="po-ttd">` sampai `</table>`) menjadi:

```ts
  ${(() => {
    const skema: SkemaTtd = d.skemaTtd === 4 ? 4 : 3;
    const nama: Record<Pihak, string | undefined> = {
      kepala_sekolah: d.sekolah.kepala_sekolah, partnership_manager: d.namaPm,
      regional_head: d.namaRh, sales_manager: d.namaSm,
    };
    const daftar = pihakUntuk(skema);
    return `<table class="po-ttd${skema === 4 ? ' empat' : ''}">
    <thead><tr>${daftar.map((p) => `<th>${labelPihak(p, skema)}</th>`).join('')}</tr></thead>
    <tbody><tr>
      ${daftar.map((pihak) => {
        const n = nama[pihak];
        const gambar = d.ttd?.[pihak];
        return `<td>${gambar
          ? `<img class="ttd-gambar-cetak" src="${esc(gambar)}" alt="Tanda tangan ${esc(n)}">`
          : '<span class="ttd-ruang"></span>'
        }<span class="ttd-nama">${esc(n)}</span></td>`;
      }).join('')}
    </tr></tbody>
  </table>`;
  })()}
```

Spasi dan baris baru di luar kolom yang dirender harus sama persis dengan markup lama untuk
skema 3; bila golden lama berselisih hanya di spasi, samakan templatnya, jangan rekam ulang.

- [ ] **Langkah 3: Implementasi `lib/dokumen-dari-po.ts`**

Di `BarisPo`, sesudah `nama_pm: string | null; nama_sm: string | null;` tambahkan:

```ts
  /** Tak ada pada data lama dan fikstur lama; tidak ada = skema 3. */
  skema_ttd?: number | null;
  nama_rh?: string | null;
```

Di `dataDokumenDariPo`, sesudah `namaSm: po.nama_sm ?? undefined,` tambahkan:

```ts
    // Kunci ini hanya ADA untuk PO empat penanda tangan, pola yang sama dengan `kelompok`
    // di bawah: objek data PO lama tetap sama dengan kemarin.
    ...(skemaDari(po.skema_ttd) === 4 ? { skemaTtd: 4 as const, namaRh: po.nama_rh ?? undefined } : {}),
```

dan impor `skemaDari` dari `./pihak`.

- [ ] **Langkah 4: CSS** — di `app/globals.css` sesudah `.po-ttd td{...}`:

```css
.po-ttd.empat td,.po-ttd.empat th{width:25%}
.po-ttd .ttd-nama{overflow-wrap:anywhere}
```

- [ ] **Langkah 5: Rekam golden baru saja, pastikan golden lama identik**

```bash
BUAT_EMAS=1 node uji/emas.test.mjs
git status --short uji/emas/
```
Harapan: HANYA empat berkas `sma-empat-ttd.*` yang baru; tidak ada `M` pada berkas lama. Bila
ada, perbaiki kode sampai `git diff uji/emas/` kosong untuk berkas lama. Periksa
`uji/emas/sma-empat-ttd.po.html`: empat `<th>` urut Kepala Sekolah, Partnership Manager,
Regional Head Division, Head of Sales.

- [ ] **Langkah 6: Pratinjau cetak diukur** — buat `uji/pratinjau-empat-ttd.mjs`:

```js
// Halaman 2 Form PO empat kotak, dipotret di A4 (794px) dan 375px. viewport sengaja diwajibkan.
import { writeFileSync, readFileSync } from 'node:fs';
const html = readFileSync(new URL('./emas/sma-empat-ttd.po.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
writeFileSync(new URL('./_empat-ttd.html', import.meta.url),
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">`
  + `<style>${css}</style></head><body>${html}</body></html>`);
console.log('uji/_empat-ttd.html ditulis');
```

Jalankan skrip, buka `uji/_empat-ttd.html` di peramban headless yang tersedia (Chrome tidak ada
di Mac ini; pakai chromium headless-shell dari cache ms-playwright lewat `playwright-core` di
direktori sementara di luar repo, seperti 21 Sep). Ukur di lebar 794 dan 375:
`document.documentElement.scrollWidth === clientWidth`, dan setiap `.po-ttd td` punya
`scrollWidth <= clientWidth`. Catat keempat angka di pesan commit. Hapus `uji/_empat-ttd.html`
sebelum commit (tambahkan pola `uji/_*.html` ke `.gitignore` bila belum ada).

- [ ] **Langkah 7: Jalankan dan commit**

Jalankan: `node --test uji/emas.test.mjs && npm run periksa`
Harapan: LULUS, termasuk `sma-empat-ttd`.

```bash
git add lib/dokumen-po.ts lib/dokumen-dari-po.ts app/globals.css uji/emas.test.mjs uji/emas/sma-empat-ttd.* uji/pratinjau-empat-ttd.mjs .gitignore
git commit -m "Form PO: halaman 2 empat kotak untuk skema 4, PO lama tetap byte-identik"
```

---

### Tugas 4: Peran Regional Head Division di aplikasi

**Berkas:**
- Ubah: `lib/supabase-server.ts` (`Peran`, `LABEL_PERAN`, `bolehLihatAcquisition`, `bolehLihatSemua`)
- Ubah: `lib/pengguna-aksi.ts` (`SEMUA_PERAN`)
- Ubah: `uji/peran-baca-saja.test.mjs`

**Antarmuka:**
- Menghasilkan: `Peran` memuat `'regional_head'`; `LABEL_PERAN.regional_head === 'Regional Head Division'`.

- [ ] **Langkah 1: Periksa penyaring daftar penanda tangan** (Fokus tinjauan 5).

```bash
grep -l "function daftar_penanda_tangan\|function public.daftar_penanda_tangan" supabase/migrations/*.sql | tail -1 \
  | xargs awk '/function (public\.)?daftar_penanda_tangan/,/\$\$;/'
```
Bila penyaringnya memakai `private.punya_peran(...)` (yang meloloskan Super Admin), catat di
laporan tugas dan TAMBAHKAN probe P10 di `bukti-empat-ttd.sql` yang memanggil
`daftar_penanda_tangan(array['regional_head']::peran[])` sebagai `sales@uji` dan menuntut hanya
`rh@uji`; bila probe itu gagal, berhenti dan laporkan (perbaikannya keputusan Rizki). Bila
penyaringnya `peran && p_peran` atau setara, cukup catat di laporan.

- [ ] **Langkah 2: Tulis uji yang gagal** — di `uji/peran-baca-saja.test.mjs`, ubah
  `const PENGAWAS = ['c_level', 'cbo', 'head_of_operations'];` menjadi
  `const PENGAWAS = ['c_level', 'cbo', 'head_of_operations', 'regional_head'];` lalu tambahkan
  sebelum `// Super Admin justru sebaliknya`:

```js
// Regional Head Division (catatan/23): baca-saja pola C Level, termasuk Acquisition.
assert.equal(LABEL_PERAN.regional_head, 'Regional Head Division');
assert.equal(bolehLihatAcquisition(['regional_head']), true);
assert.equal(mod.exports.bolehLihatSemua(['regional_head']), true);
assert.equal(bolehKomentar(['regional_head']), true,
  'Regional Head boleh berkomentar; yang menulis nol hanya C Level');
ok('Regional Head Division: melihat semua termasuk Acquisition, tidak menulis keputusan');
```

Jalankan: `node --test uji/peran-baca-saja.test.mjs`
Harapan: GAGAL (`LABEL_PERAN.regional_head` undefined).

Catatan keputusan komentar: spesifikasi tidak melarang Regional Head berkomentar, dan
`bolehKomentar` hanya menutup `c_level`. Bila Rizki menginginkan sebaliknya, itu perubahan
satu baris di `bolehKomentar` dan kebijakan komentar di basis data; jangan dikerjakan tanpa
keputusan.

- [ ] **Langkah 3: Implementasi**

`lib/supabase-server.ts`:
- `Peran`: tambahkan `| 'regional_head'` di baris terakhir union.
- `LABEL_PERAN`: tambahkan `regional_head: 'Regional Head Division',` sesudah `c_level`.
- `bolehLihatAcquisition`: `berperan(p, ['cbo', 'c_level', 'admin_utama', 'head_of_operations', 'finance', 'regional_head'])`.
- `bolehLihatSemua`: tambahkan `'regional_head'` di akhir daftar.

`lib/pengguna-aksi.ts`: tambahkan `'regional_head'` di akhir `SEMUA_PERAN`.

- [ ] **Langkah 4: Jalankan dan commit**

Jalankan: `node --test uji/peran-baca-saja.test.mjs && npm run periksa`
Harapan: LULUS.

```bash
git add lib/supabase-server.ts lib/pengguna-aksi.ts uji/peran-baca-saja.test.mjs uji/db-lokal/bukti-empat-ttd.sql
git commit -m "Peran Regional Head Division: baca-saja pola C Level"
```

---

### Tugas 5: Aksi server dan syarat cetak mengenal skema

**Berkas:**
- Ubah: `lib/po-aksi.ts` (`IsiPo`, `kolomIsi`, select `lama`, `berubah`, insert, `simpanTtd`,
  `ajukanVerifikasi`, penghapusan berkas di `kirimUntukTtd`/`kembalikanKeDraf`)
- Ubah: `lib/kelengkapan-po.ts`
- Ubah: `lib/isi-po-form.ts`
- Uji: `uji/kelengkapan-po.test.mjs`, `uji/isi-po.test.mjs`, `uji/po-aksi-skema.test.mjs` (baru)

**Antarmuka:**
- Mengonsumsi: `pihakUntuk`, `SEMUA_PIHAK`, `skemaDari`, `type SkemaTtd` (Tugas 1).
- Menghasilkan (dipakai Tugas 6, 7):
  - `IsiPo.namaRh?: string`; `IsiPo.formKertasLama?: true` (hanya bermakna saat membuat PO unggahan)
  - `IsianPo.namaRh?: string`; `IsianPo.skemaTtd?: SkemaTtd` (tanpa = 3)
  - `MasukanIsiPo.lain.namaRh: string`; `MasukanIsiPo.formKertasLama?: boolean`
  - `export const PESAN_TANPA_RH = 'Regional Head Division belum dipilih.'` di `lib/kelengkapan-po.ts`

- [ ] **Langkah 1: Tulis uji yang gagal** — tambahkan ke `uji/kelengkapan-po.test.mjs` (fikstur
  `lengkap()` sudah ada di berkas itu; `kekuranganPo` diimpor dari modul yang sama dengan
  `kurangLengkapPo`, tambahkan ke destrukturisasi `muat` bila belum):

```js
// Empat penanda tangan (catatan/23): Regional Head hanya ditagih pada skema 4.
{
  const tanpaSkema = kekuranganPo({ ...lengkap() });
  assert.ok(!tanpaSkema.some((h) => /Regional Head/.test(h.pesan)), 'skema 3 tidak menagih Regional Head');
  const empat = kekuranganPo({ ...lengkap(), skemaTtd: 4 });
  assert.ok(empat.some((h) => h.langkah === 'penanda' && h.pesan === 'Regional Head Division belum dipilih.'));
  const empatLengkap = kekuranganPo({ ...lengkap(), skemaTtd: 4, namaRh: 'RH' });
  assert.ok(!empatLengkap.some((h) => /Regional Head/.test(h.pesan)));
  const label4 = kekuranganPo({ ...lengkap(), skemaTtd: 4, namaRh: 'RH', namaSm: '' });
  assert.ok(label4.some((h) => h.pesan === 'Head of Sales belum dipilih.'));
  const label3 = kekuranganPo({ ...lengkap(), namaSm: '' });
  assert.ok(label3.some((h) => h.pesan === 'Sales Manager belum dipilih.'));
  console.log('  OK  Regional Head ditagih hanya pada skema 4; label SM mengikuti skema');
}
```

Tambahkan ke `uji/isi-po.test.mjs` (sesudah perbandingan golden yang ada):

```js
// Golden kiriman tidak berubah karena bidang baru (catatan/23): namaRh kosong dan
// formKertasLama tidak dicentang tidak menambah kunci apa pun.
{
  const dasar = KASUS.satu;
  const isi = susunIsiPo({ ...dasar, lain: { ...dasar.lain, namaRh: '' }, formKertasLama: false });
  assert.ok(!('namaRh' in isi) || isi.namaRh === undefined);
  assert.ok(!('formKertasLama' in isi));
  const lama = susunIsiPo({ ...dasar, asal: 'unggahan', formKertasLama: true });
  assert.equal(lama.formKertasLama, true);
  const rh = susunIsiPo({ ...dasar, lain: { ...dasar.lain, namaRh: 'RH Uji' } });
  assert.equal(rh.namaRh, 'RH Uji');
  console.log('  OK  namaRh dan formKertasLama hanya terkirim bila terisi');
}
```

(`KASUS.satu` = fikstur PO satu kelompok yang sudah ada di `uji/isi-po.test.mjs`.)

Baru, `uji/po-aksi-skema.test.mjs`: penjaga statis bahwa aksi server tidak lagi memakai angka
3 harfiah untuk kelengkapan tanda tangan.

```js
// Aksi server tanda tangan membaca pihak wajib dari skema PO, bukan angka 3 (catatan/23).
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

const src = readFileSync(new URL('../lib/po-aksi.ts', import.meta.url), 'utf8');
const badan = (nama) => {
  const i = src.indexOf(`export async function ${nama}(`);
  assert.ok(i >= 0, `${nama} tidak ditemukan`);
  const j = src.indexOf('\nexport ', i + 1);
  return src.slice(i, j < 0 ? undefined : j);
};
for (const f of ['simpanTtd', 'ajukanVerifikasi']) {
  const b = badan(f);
  assert.doesNotMatch(b, /[<>]=?\s*3\b/, `${f} masih membandingkan dengan 3 harfiah`);
  assert.match(b, /pihakUntuk\(skemaDari\(/, `${f} tidak membaca pihak wajib dari skema PO`);
}
for (const f of ['kirimUntukTtd', 'kembalikanKeDraf']) {
  assert.match(badan(f), /SEMUA_PIHAK\.map/, `${f} tidak menghapus berkas keempat pihak`);
}
assert.doesNotMatch(src, /URUT_PIHAK/, 'po-aksi masih memakai URUT_PIHAK');
console.log('  OK  aksi tanda tangan membaca skema PO');
```

Jalankan: `node --test uji/kelengkapan-po.test.mjs uji/isi-po.test.mjs uji/po-aksi-skema.test.mjs`
Harapan: GAGAL.

- [ ] **Langkah 2: `lib/kelengkapan-po.ts`**

Di `IsianPo`, sesudah `namaSm?: string;`:

```ts
  /** Regional Head Division; hanya ditagih pada skema 4. */
  namaRh?: string;
  /** Tanpa = 3: PO lama dan draf yang dibuat sebelum 25 Sep 2026 (catatan/23). */
  skemaTtd?: SkemaTtd;
```

Tambahkan `import { labelPihak, type SkemaTtd } from './pihak';` dan
`export const PESAN_TANPA_RH = 'Regional Head Division belum dipilih.';`

Di `kekuranganPo`, ganti dua baris PM/SM menjadi:

```ts
    ...(kosong(d.namaPm) ? [di('penanda', 'Partnership Manager belum dipilih.')] : []),
    ...(d.skemaTtd === 4 && kosong(d.namaRh) ? [di('penanda', PESAN_TANPA_RH)] : []),
    ...(kosong(d.namaSm)
      ? [di('penanda', `${labelPihak('sales_manager', d.skemaTtd === 4 ? 4 : 3)} belum dipilih.`)] : []),
```

Pesan `PESAN_TANPA_RH` sama persis dengan pesan basis data (migrasi B bagian 3).

- [ ] **Langkah 3: `lib/isi-po-form.ts`**

Di `MasukanIsiPo.lain` tambahkan `namaRh: string;` (sesudah `namaSm`), dan di `MasukanIsiPo`
tambahkan:

```ts
  /** Centang "Form kertas lama (3 kotak)" di langkah 0; hanya bermakna saat membuat PO unggahan. */
  formKertasLama?: boolean;
```

Di `susunIsiPo`, sesudah `namaSm: p.lain.namaSm || undefined,`:

```ts
    namaRh: p.lain.namaRh || undefined,
```

dan sebelum `asal: p.asal,`:

```ts
    // Hanya terkirim bila dicentang: kiriman PO lain tetap sama dengan rekaman emasnya.
    ...(p.formKertasLama && p.asal === 'unggahan' && !p.adaAwal ? { formKertasLama: true as const } : {}),
```

- [ ] **Langkah 4: `lib/po-aksi.ts`**

1. `IsiPo`: sesudah `namaSm?: string;` tambahkan

```ts
  /** Regional Head Division; hanya bermakna pada PO skema 4 (catatan/23). */
  namaRh?: string;
  /**
   * PO unggahan dari form kertas lama tiga kotak. Hanya dibaca saat PO DIBUAT; basis data
   * (jaga_syarat_maju) mengabaikannya untuk PO platform dan membekukan skemanya sesudah lahir.
   */
  formKertasLama?: true;
```

2. `kolomIsi`: sesudah `nama_sm: isi.namaSm || null,` tambahkan `nama_rh: isi.namaRh || null,`.
3. Select `lama`: tambahkan `nama_rh` sesudah `nama_sm` di string select.
4. Insert: ganti `.insert({ ...kolomPo, dibuat_oleh: hasil.pengguna.email })` menjadi

```ts
      .insert({
        ...kolomPo, dibuat_oleh: hasil.pengguna.email,
        // Hanya usulan: trigger jaga_syarat_maju memutuskan (3 hanya untuk unggahan).
        skema_ttd: asal === 'unggahan' && isi.formKertasLama ? 3 : 4,
      })
```

5. Impor: ganti `import { URUT_PIHAK, type Pihak } from './pihak';` menjadi
   `import { SEMUA_PIHAK, pihakUntuk, skemaDari, type Pihak } from './pihak';`
6. `kirimUntukTtd` dan `kembalikanKeDraf`: ganti `URUT_PIHAK.map(` menjadi `SEMUA_PIHAK.map(`
   (menghapus jalur yang tidak ada tidak galat).
7. `simpanTtd`: ganti blok "Lengkap bertiga" menjadi

```ts
  // Lengkap = semua pihak wajib skema PO ini sudah ada. Basis data menolak kurang dari itu
  // (po_urutan_status); pemeriksaan di sini supaya tidak mencoba lompatan yang pasti ditolak.
  const { data: po } = await sb.from('po').select('skema_ttd').eq('id', poId).maybeSingle();
  const { data: semua } = await sb.from('tanda_tangan').select('pihak').eq('po_id', poId);
  const ada = new Set((semua ?? []).map((t) => t.pihak));
  if (po && pihakUntuk(skemaDari(po.skema_ttd)).every((p) => ada.has(p))) {
    await sb.from('po').update({ status: 'ditandatangani' }).eq('id', poId).eq('status', 'menunggu_ttd');
  }
```

8. `ajukanVerifikasi`: ganti pemeriksaan `count` menjadi

```ts
  const { data: po } = await sb.from('po').select('skema_ttd').eq('id', id).maybeSingle();
  const { data: semua } = await sb.from('tanda_tangan').select('pihak').eq('po_id', id);
  const ada = new Set((semua ?? []).map((t) => t.pihak));
  if (!po || !pihakUntuk(skemaDari(po.skema_ttd)).every((p) => ada.has(p)))
    return { ok: false, galat: 'Belum semua pihak menandatangani.' };
```

- [ ] **Langkah 5: Jalankan dan commit**

Jalankan: `node --test uji/kelengkapan-po.test.mjs uji/isi-po.test.mjs uji/po-aksi-skema.test.mjs uji/emas.test.mjs && npm run periksa`
Harapan: LULUS; `git status --short uji/emas/` kosong (golden kiriman tidak berubah).

```bash
git add lib/po-aksi.ts lib/kelengkapan-po.ts lib/isi-po-form.ts uji/kelengkapan-po.test.mjs uji/isi-po.test.mjs uji/po-aksi-skema.test.mjs
git commit -m "Aksi PO: Regional Head dan kelengkapan tanda tangan per skema"
```

---

### Tugas 6: Wizard: dropdown Regional Head dan centang form kertas lama

**Berkas:**
- Ubah: `app/(sistem)/po/baru/use-form-po.ts`
- Ubah: `app/(sistem)/po/baru/langkah/penanda.tsx`
- Ubah: `app/(sistem)/po/baru/langkah/cara.tsx`
- Ubah: `app/(sistem)/po/baru/page.tsx`, `app/(sistem)/po/baru/form-po.tsx` (teruskan prop)
- Ubah: `app/(sistem)/po/[id]/page.tsx` (awal `skemaTtd`/`namaRh`, prop `akunRh`)
- Ubah: `uji/pratinjau-wizard.tsx`

**Antarmuka:**
- Mengonsumsi: `IsiPo.namaRh`, `IsiPo.formKertasLama`, `MasukanIsiPo.lain.namaRh`,
  `MasukanIsiPo.formKertasLama`, `IsianPo.skemaTtd/namaRh`, `PESAN_TANPA_RH` (Tugas 5);
  `labelPihak`, `skemaDari`, `type SkemaTtd` (Tugas 1).
- Menghasilkan: `PropsFormPo.akunRh: { email: string; nama: string | null }[]`;
  `PropsFormPo.awal?.skemaTtd` lewat `IsiPo & { skemaTtd?: SkemaTtd }` (tipe `awal` diperluas
  di `use-form-po.ts` saja); `f.skema: SkemaTtd`, `f.formKertasLama`, `f.setFormKertasLama`,
  `f.akunRh` di hasil `useFormPo`.

- [ ] **Langkah 1: `use-form-po.ts`**

1. `PropsFormPo`: ubah `awal?: IsiPo;` menjadi `awal?: IsiPo & { skemaTtd?: SkemaTtd };`, ubah
   komentar `akunSm` menjadi "calon Head of Sales (Sales Manager pada PO lama)", tambahkan

```ts
  /** Pemegang peran Regional Head Division (catatan/23). */
  akunRh: { email: string; nama: string | null }[];
```

2. Destrukturisasi props: tambahkan `akunRh`.
3. Sesudah `const [sesuaiPindaian, setSesuaiPindaian] = useState(false);`:

```ts
  // Hanya saat MEMBUAT PO unggahan. Skema PO yang sudah ada dibaca dari data dan beku.
  const [formKertasLama, setFormKertasLama] = useState(false);
  const skema: SkemaTtd = awal
    ? skemaDari(awal.skemaTtd)
    : asal === 'unggahan' && formKertasLama ? 3 : 4;
```

4. `lain`: sesudah `namaSm: awal?.namaSm ?? '',` tambahkan `namaRh: awal?.namaRh ?? '',`.
5. Pemanggilan `kekuranganPo({...})`: tambahkan `namaRh: lain.namaRh, skemaTtd: skema,`.
6. Pemanggilan `dokumenPo({...})` (pratinjau): sesudah `namaPm: lain.namaPm, namaSm: lain.namaSm,`
   tambahkan `...(skema === 4 ? { skemaTtd: 4 as const, namaRh: lain.namaRh } : {}),`.
7. Pemanggilan `susunIsiPo({...})`: tambahkan `formKertasLama,` (field `lain` sudah membawa `namaRh`).
8. Objek yang dikembalikan hook: tambahkan `skema, formKertasLama, setFormKertasLama, akunRh`.
9. Impor `skemaDari, type SkemaTtd` dari `@/lib/pihak`.

Bila isi `awal` untuk halaman sunting dibangun di `app/(sistem)/po/[id]/page.tsx` (blok di sekitar
baris 95-120), tambahkan di sana `namaRh: po.nama_rh ?? undefined,` dan
`skemaTtd: skemaDari(po.skema_ttd),`, lalu teruskan `akunRh` ke `<FormPo>` dengan mengubah
`Promise.all` menjadi:

```ts
  const [akunPm, akunSm, akunRh] = await Promise.all([
    daftarPengguna(['sales']),
    daftarPengguna(['head_of_sales']),
    daftarPengguna(['regional_head']),
  ]);
```

Lakukan perubahan `Promise.all` yang sama di `app/(sistem)/po/baru/page.tsx`, dan teruskan
`akunRh={akunRh}` di kedua halaman serta di `form-po.tsx` bila ia meneruskan props satu per satu.

- [ ] **Langkah 2: `langkah/penanda.tsx`** — ambil `akunRh, skema` dari `f`; ganti blok dua
  dropdown menjadi:

```tsx
            <div className="f">
              <label htmlFor="f-pm">Partnership Manager</label>
              <select id="f-pm" value={lain.namaPm} onChange={(e) => setLain({ ...lain, namaPm: e.target.value })}>
                <option value="">- pilih -</option>
                {akunPm.map((a) => (
                  <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                ))}
              </select>
            </div>
            {skema === 4 && (
              <div className="f">
                <label htmlFor="f-rh">Regional Head Division</label>
                <select id="f-rh" value={lain.namaRh} disabled={!akunRh.length}
                  onChange={(e) => setLain({ ...lain, namaRh: e.target.value })}>
                  <option value="">- pilih -</option>
                  {akunRh.map((a) => (
                    <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                  ))}
                </select>
                {!akunRh.length && (
                  <span className="hint">Belum ada akun Regional Head Division. Minta Super Admin memberikan perannya di Kelola Pengguna.</span>
                )}
              </div>
            )}
            <div className="f">
              <label htmlFor="f-sm">{labelPihak('sales_manager', skema)}</label>
              <select id="f-sm" value={lain.namaSm} onChange={(e) => setLain({ ...lain, namaSm: e.target.value })}>
                <option value="">- pilih -</option>
                {akunSm.map((a) => (
                  <option key={a.email} value={a.nama || a.email}>{a.nama || a.email}</option>
                ))}
              </select>
            </div>
```

Impor `labelPihak` dari `@/lib/pihak`. Periksa kelas `.hint` di dalam `.f` sudah punya gaya
yang terbaca di kedua tema (bila tidak, pakai kelas pesan yang sudah dipakai langkah lain,
mis. `.muat`/`.muted`, sesuai `DESIGN.md`).

Fokus tinjauan 4: halangan di Tinjau untuk skema 4 tanpa akun RH. Tambahkan di `use-form-po.ts`,
tepat sesudah `halanganCetak` dihitung, pengganti pesan agar menyebut penyebabnya:

```ts
  const halanganCetakAkhir: Halangan[] = skema === 4 && !akunRh.length
    ? halanganCetak.map((h) => h.pesan === PESAN_TANPA_RH
        ? { ...h, pesan: 'Belum ada akun Regional Head Division. Minta Super Admin memberikan perannya.' } : h)
    : halanganCetak;
```

dan pakai `halanganCetakAkhir` di tempat `halanganCetak` dipakai sesudahnya (termasuk
`kurangLengkap`).

- [ ] **Langkah 3: `langkah/cara.tsx`** — ambil `formKertasLama, setFormKertasLama` dari `f`.
  Ganti kalimat "sudah ditandatangani ketiga pihak" menjadi "sudah ditandatangani semua pihak",
  dan sesudah `<input type="file" .../>` tambahkan:

```tsx
            <label className="centang" style={{ display: 'flex', gap: 8, marginTop: 12, fontSize: 13.5 }}>
              <input type="checkbox" checked={formKertasLama}
                onChange={(e) => setFormKertasLama(e.target.checked)} />
              <span>
                Form kertas lama (3 kotak tanda tangan, tanpa Regional Head Division).
                Tidak bisa diubah sesudah PO disimpan.
              </span>
            </label>
```

Periksa kelas centang yang sudah dipakai di wizard (mis. di `tinjau.tsx` untuk pernyataan
sesuai pindaian) dan pakai kelas yang sama bila ada, bukan gaya sebaris.

- [ ] **Langkah 4: Pratinjau** — di `uji/pratinjau-wizard.tsx`, tambahkan `akunRh` ke props yang
  dioper (satu akun `{ email: 'rh@uji', nama: 'RH Uji' }`) dan `namaRh: 'RH Uji'` ke fikstur
  `awal` bila berkas itu memakai `awal`. Tambahkan satu pratinjau kedua dengan `akunRh: []`
  untuk memotret pesan akun kosong. Ikuti pola berkas pratinjau lain (viewport wajib).

- [ ] **Langkah 5: Jalankan dan commit**

Jalankan: `npm run periksa`
Harapan: LULUS.

Verifikasi mata (lebar 375 dan 1200, dua tema): langkah Penanda PO baru menampilkan tiga
dropdown berurutan PM, Regional Head Division, Head of Sales; draf skema 3 (pakai fikstur
`awal` dengan `skemaTtd: 3`) menampilkan dua dropdown dengan label "Sales Manager"; langkah 0
jalur unggah menampilkan centang. Ukur `scrollWidth === clientWidth`, catat di pesan commit.

```bash
git add "app/(sistem)/po" uji/pratinjau-wizard.tsx
git commit -m "Wizard PO: Regional Head Division, label Head of Sales, centang form kertas lama"
```

---

### Tugas 7: Panel tanda tangan, lini masa, dan pembersihan

**Berkas:**
- Ubah: `app/(sistem)/po/[id]/panel-ttd.tsx`
- Ubah: `app/(sistem)/po/[id]/page.tsx`
- Ubah: `lib/lini-masa.ts`
- Ubah: `lib/pihak.ts` (hapus `URUT_PIHAK`, `LABEL_PIHAK`)
- Uji: `uji/lini-masa.test.mjs`, `uji/pihak.test.mjs`

**Antarmuka:**
- Mengonsumsi: `pihakUntuk`, `labelPihak`, `skemaDari` (Tugas 1); kolom `skema_ttd`, `nama_rh`.
- Menghasilkan: prop `PanelTtd.skema: SkemaTtd`; masukan `liniMasa({ ..., skema?: number })`.

- [ ] **Langkah 1: Tulis uji yang gagal**

Di `uji/lini-masa.test.mjs`, tambahkan (pakai pembangun masukan yang sudah ada di berkas itu):

```js
// Label tanda tangan mengikuti skema PO (catatan/23).
{
  const ttd = [{ pihak: 'sales_manager', nama: 'Agung', waktu: '2026-09-25T01:00:00Z', dibubuhkan_oleh: 's@uji' },
               { pihak: 'regional_head', nama: 'Zhurry', waktu: '2026-09-25T02:00:00Z', dibubuhkan_oleh: 's@uji' }];
  const empat = liniMasa({ riwayat: [], ttd, verifikasi: [], surat: null, pks: null, komentar: [], skema: 4 });
  assert.ok(empat.some((e) => e.judul === 'Head of Sales menandatangani'));
  assert.ok(empat.some((e) => e.judul === 'Regional Head Division menandatangani'));
  const lama = liniMasa({ riwayat: [], ttd: ttd.slice(0, 1), verifikasi: [], surat: null, pks: null, komentar: [] });
  assert.ok(lama.some((e) => e.judul === 'Sales Manager menandatangani'), 'PO lama tetap Sales Manager');
  console.log('  OK  label tanda tangan di lini masa mengikuti skema');
}
```

(Semua bidang `SumberLiniMasa` opsional, jadi `{ ttd, skema }` saja sudah sah; bidang kosong
di atas boleh dibuang.)

Di `uji/pihak.test.mjs`, tambahkan sebelum baris akhir:

```js
import { readFileSync, readdirSync, statSync } from 'node:fs';
const telusuri = (d) => readdirSync(d).flatMap((f) => {
  const j = `${d}/${f}`;
  if (f === 'node_modules' || f.startsWith('.')) return [];
  return statSync(j).isDirectory() ? telusuri(j) : /\.(ts|tsx)$/.test(f) ? [j] : [];
});
const akar = new URL('..', import.meta.url).pathname;
const pemakai = [...telusuri(`${akar}app`), ...telusuri(`${akar}lib`)]
  .filter((f) => /\bURUT_PIHAK\b|\bLABEL_PIHAK\b/.test(readFileSync(f, 'utf8')));
assert.deepEqual(pemakai, [], 'URUT_PIHAK/LABEL_PIHAK masih dipakai: ' + pemakai.join(', '));
ok('tidak ada lagi daftar atau label pihak di luar pihakUntuk/labelPihak');
```

Pindahkan kedua `import` ke kepala berkas.

Jalankan: `node --test uji/lini-masa.test.mjs uji/pihak.test.mjs`
Harapan: GAGAL.

- [ ] **Langkah 2: `lib/lini-masa.ts`**

- Hapus `const LABEL_PIHAK: Record<string, string> = {...}`.
- Tambah `import { labelPihak, skemaDari, type Pihak } from './pihak';`
- Tambahkan `skema?: number | null;` ke tipe masukan `liniMasa` (di samping `ttd`).
- Judul tanda tangan: `judul: \`${labelPihak(t.pihak as Pihak, skemaDari(s.skema))} menandatangani\`,`
  (pihak tak dikenal tidak mungkin: enum basis data).
- `LABEL_STATUS.ditandatangani`: `'Semua tanda tangan lengkap'` (dulu "Ketiga"; label layar,
  bukan dokumen bertanda tangan).

- [ ] **Langkah 3: `panel-ttd.tsx`**

- Props: tambahkan `skema: SkemaTtd;`, ubah tipe `nama` menjadi `Partial<Record<Pihak, string>>`.
- Impor: `import { pihakUntuk, labelPihak, type Pihak, type SkemaTtd } from '@/lib/pihak';`
- `const daftar = pihakUntuk(skema);` lalu `const lengkap = daftar.every(sudah);` dan
  `URUT_PIHAK.map` menjadi `daftar.map`; `LABEL_PIHAK[p]` menjadi `labelPihak(p, skema)` (tiga
  tempat termasuk judul kanvas).
- Teks jumlah:

```tsx
        {lengkap
          ? 'Semua pihak sudah menandatangani.'
          : `${ttd.filter((t) => daftar.includes(t.pihak)).length} dari ${daftar.length} pihak sudah menandatangani.`}
```

- Petunjuk nama kosong: `p === 'kepala_sekolah' ? ' di bagian Data sekolah.' : ' di langkah Penanda tangan & catatan.'`
  (label bagian lama "Masa aktif & catatan" sudah tidak ada sejak wizard; sesuaikan bila teks
  langkah di `lib/langkah-po.ts` berbeda: judulnya "Penanda tangan & catatan").
- Periksa kisi `.ttd-kisi` di `globals.css` menampung empat kartu di 375 dan 1200; bila memakai
  `repeat(3, ...)` harfiah, ganti menjadi `repeat(auto-fit, minmax(<lebar kartu sekarang>, 1fr))`.

- [ ] **Langkah 4: `po/[id]/page.tsx`**

- `<PanelTtd ... skema={skemaDari(po.skema_ttd)}` dan objek `nama` tambah
  `regional_head: po.nama_rh ?? undefined,`.
- `liniMasa({ ..., skema: po.skema_ttd })`.
- Impor `skemaDari` dari `@/lib/pihak`.

- [ ] **Langkah 5: `lib/pihak.ts`** — hapus `URUT_PIHAK` dan `LABEL_PIHAK` beserta komentar
  `@deprecated`.

- [ ] **Langkah 6: Jalankan dan commit**

Jalankan: `npm run periksa`
Harapan: LULUS.

Verifikasi mata panel tanda tangan: skema 4 empat kartu, skema 3 tiga kartu berlabel "Sales
Manager"; 375 dan 1200, dua tema; `scrollWidth === clientWidth`. Fokus tinjauan 3: panel skema 4
dengan tiga tanda tangan menulis "3 dari 4".

```bash
git add "app/(sistem)/po/[id]" lib/lini-masa.ts lib/pihak.ts app/globals.css uji/lini-masa.test.mjs uji/pihak.test.mjs
git commit -m "Panel tanda tangan dan lini masa membaca skema PO; daftar pihak lama dibuang"
```

---

### Tugas 8: Penyaring akhir dan QA independen

**Berkas:**
- Ubah: `catatan/23-spesifikasi-empat-penanda-tangan.md` (status → DIBANGUN, catatan pembangunan)

- [ ] **Langkah 1: Gerbang penuh**

```bash
rm -rf .next
npm run periksa
npm run build
```
Harapan: `periksa` hijau; `build` exit 0 dan `postbuild` (`pindai-bundel.mjs`) bersih.

- [ ] **Langkah 2: Ulangi bukti basis data dari nol** (Tugas 2 langkah 6, semua probe termasuk
  P10 bila ada). Harapan: semua `OK`.

- [ ] **Langkah 3: Pencarian sisa "tiga pihak"**

```bash
grep -rn "ketiga pihak\|Ketiga pihak\|dari 3\|bertiga" app lib supabase/migrasi/20260925*.sql
```
Harapan: tidak ada kecocokan di teks layar/aksi yang menyangkut skema 4. Kecocokan di komentar
historis boleh, sebutkan di laporan.

- [ ] **Langkah 4: QA independen** — kirim sub-agen QA dengan mandat baca-saja: catat
  `git rev-parse HEAD` dan `git status --porcelain` sebelum dan sesudah; QA membaca
  `catatan/23`, rencana ini, dan diff `536f77f..HEAD` (tanpa commit spesifikasi ekstraksi),
  menjalankan `npm run periksa`, `npm run build`, dan bukti basis data lokal sendiri, lalu
  memberi verdict PASS/FAIL dengan temuan Critical/Important/Minor berujuk baris. Untuk temuan
  tata letak, QA WAJIB menyertakan angka `scrollWidth/clientWidth`, bukan penilaian.

- [ ] **Langkah 5: Perbarui spesifikasi dan commit**

Status `catatan/23` menjadi `**DIBANGUN 25 Sep 2026**, belum tayang` dan tambahkan bagian
"Catatan pembangunan" berisi penyimpangan dari rencana (bila ada), hasil P1-P10, angka tata
letak, dan verdict QA.

```bash
git add catatan/23-spesifikasi-empat-penanda-tangan.md
git commit -m "catatan/23: dibangun, QA independen <verdict>"
```

---

### Tugas 9: Rilis ke produksi (HANYA dengan persetujuan eksplisit Rizki)

Tugas ini menulis ke produksi. Berhenti sebelum langkah 1 dan minta persetujuan dengan ringkasan
hasil Tugas 8.

- [ ] **Langkah 1: Push kode**

```bash
gh auth switch --user rizki-skolla
git push -u origin build/ekstraksi-scan-po
```

- [ ] **Langkah 2: Migrasi, tepat sebelum deploy** (urutan penerapan di `catatan/23`)

```bash
supabase migration list --linked | tail -3     # 69 cocok, dua lokal baru belum di awan
supabase db push --dry-run                       # tepat dua migrasi 20260925*
supabase db push
supabase migration list --linked | tail -3     # 71 cocok
```

- [ ] **Langkah 3: Deploy** (Vercel TIDAK tersambung git)

```bash
vercel --prod --yes
```

- [ ] **Langkah 4: Smoke check**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://skolla-kerjasama.vercel.app/beranda   # 307
curl -s -o /dev/null -w "%{http_code}\n" https://skolla-kerjasama.vercel.app/masuk     # 200
```

Lewat Supabase MCP `execute_sql` (baca-saja):
`select skema_ttd, count(*) from po group by 1;` Harapan: semua PO lama bernilai 3.

- [ ] **Langkah 5: Peran Zhurry** — Rizki (Super Admin) membuka Kelola Pengguna di produksi dan
  mengubah `zhurry@skolla.education` dari Head of Sales menjadi Regional Head Division. Sesudahnya
  periksa `pengguna_riwayat` mencatat perubahan dengan `oleh = rizki@skolla.education`, dan
  `select email, peran from pengguna where 'head_of_sales' = any(peran) or 'regional_head' = any(peran);`
  menunjukkan Agung `{head_of_sales}`, Zhurry `{regional_head}`.

- [ ] **Langkah 6: Gabung ke main** sesuai superpowers:finishing-a-development-branch, perbarui
  `catatan/23` status → TAYANG dengan tanggal, dan catat di memori proyek.

---

## Tinjauan mandiri (dijalankan saat menulis rencana)

- Cakupan spesifikasi: skema per PO (T2), pihak/label (T1, T3, T7), peran (T2 bag. 8, T4), data
  PO `nama_rh` (T2, T5), perpindahan status (T2, T5), dokumen (T3), wizard (T6), unggahan +
  form lama (T2 bag. 3 & 7, T5, T6), ekstraksi (spesifikasi sudah diamandemen, tidak ada kode),
  uji 1-5 (T2, T3, T6, T7, T8), urutan penerapan (T9), sebelum tayang (T9 langkah 5).
- Satu tambahan yang tidak ada di spesifikasi dan ditemukan saat menulis rencana: sidik tinjauan
  PO unggahan adalah hash seluruh baris, jadi kolom baru akan membasikan setiap draf unggahan
  yang sudah ditinjau. Ditangani di T2 bagian 6 dan dibuktikan P9.
- Konsistensi nama: `pihakUntuk`, `labelPihak`, `skemaDari`, `SEMUA_PIHAK`, `SkemaTtd`,
  `PESAN_TANPA_RH`, `namaRh`, `formKertasLama`, `skema_ttd`, `nama_rh`, `private.pihak_wajib`
  dipakai sama di semua tugas.
