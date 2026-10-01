# Rencana Kerja: IoM Fase 2 (verdict di basis data + penutupan satu klik HoO)

Status: **SELESAI dan TAYANG 17 Sep 2026.** Tiga migrasi diterapkan atas persetujuan Rizki
sesudah QA independen putaran 3 PASS (putaran 1 dan 2 FAIL, temuannya di Tugas 3); bukti hidup
14/14. Migrasi ketiga (`20260917d_urutan_status_po`) tidak ada di rencana awal: lahir dari
temuan QA.

> **Untuk agen pelaksana:** WAJIB memakai superpowers:executing-plans (atau
> superpowers:subagent-driven-development) untuk menjalankan rencana ini tugas demi tugas.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** Setiap PO yang masuk `verifikasi` otomatis mendapat verdict IoM yang dihitung
basis data sendiri dan tidak bisa dipalsukan; PO yang lolos bisa ditutup `terverifikasi` oleh
Head of Operations dengan satu panggilan RPC tanpa empat persetujuan fungsi.

**Arsitektur:** Mesin aturan `iom-2026-09-17b` ditulis ulang di plpgsql (`private.nilai_iom`)
dengan kode aturan yang sama persis dengan `lib/iom.ts`. Trigger `AFTER UPDATE OF status`
mencatat verdict ke tabel `verifikasi_otomatis` (tanpa kebijakan tulis) saat PO masuk
`verifikasi`, fail-closed. Deklarasi kesiapan disimpan di `deklarasi_kesiapan`. Penutupan:
`jaga_penutupan_verifikasi` diamandemen sempit (tanpa empat hijau hanya bila Head of
Operations, nol penolakan, dan verdict TERAKHIR lolos untuk versi PO dan versi IoM ini), dan
RPC `tutup_verifikasi_otomatis` menjadi jalan HoO. Aplikasi belum berubah (antarmuka Fase 3).

**Teknologi:** Supabase Postgres (plpgsql), uji statis `node --test`, bukti di produksi dalam
transaksi yang dibatalkan.

**Spesifikasi:** `catatan/13a-aturan-iom.md` (aturan), `catatan/13` Fase 2 (keputusan 17 Sep
2026 yang menggantikan rancangan RPC), `lib/iom.ts` (rujukan kode aturan).

## Batasan global

- Tidak ada verdict yang bisa ditulis atau diubah klien: tabel verdict tanpa kebijakan
  insert/update/delete, `revoke all ... from anon, authenticated` lalu hanya `grant select`.
- Fail-closed: galat saat menilai tetap mencatat verdict `lolos = false` dengan kode
  `galat-evaluasi`, dan TIDAK pernah menghalangi PO masuk verifikasi.
- Kode aturan SQL = kode aturan `lib/iom.ts`; salinan `MIN_PESERTA` dan `KAPASITAS_SESI` di
  SQL = `lib/aturan-komponen.ts`; daftar butir = `BUTIR_DEKLARASI`. Dijaga `uji/verdict-iom.test.mjs`.
- Tanggal "hari ini" untuk masa berlaku deklarasi memakai zona `Asia/Jakarta`.
- Deklarasi yang berlaku = baris TERAKHIR (`ditandatangani_pada` terbesar) per produk
  (tindak lanjut QA Fase 1 nomor 2).
- Jalur penolakan (`ditolak`) dan jalur empat persetujuan tidak berubah.
- Pola hak RPC: `revoke all on function ... from public, anon; grant execute ... to authenticated`.
- Basis data TANPA lingkungan dev: bukti di produksi dalam satu panggilan yang diakhiri
  `raise exception`. `SET LOCAL ROLE` di dalam blok `do` tetap berlaku sesudah blok selesai:
  akhiri blok dengan `execute 'reset role'` bila ada pernyataan sesudahnya.
- QA independen SEBELUM migrasi diterapkan; penerapan hanya sesudah "ya" eksplisit Rizki.
- Commit dengan jalur eksplisit; tidak men-deploy aplikasi (tidak ada kode aplikasi berubah).

## Peta berkas

| Berkas | Tugas | Isi |
|---|---|---|
| `supabase/migrasi/20260917b_verdict_iom.sql` (baru) | 1 | deklarasi, tabel verdict, `nilai_iom`, trigger verdict |
| `supabase/migrasi/20260917c_tutup_verifikasi_otomatis.sql` (baru) | 2 | amandemen penutupan + RPC |
| `uji/verdict-iom.test.mjs` (baru) | 1, 2 | penjaga bentuk + kesamaan dengan `lib/iom.ts` |
| `catatan/13`, `catatan/15` | 5 | status |

---

### Tugas 1: Mesin aturan SQL, deklarasi, dan trigger verdict

- [ ] **Langkah 1: Baca definisi hidup** (hanya baca):

```sql
select pg_get_function_identity_arguments('private.boleh_lihat_semua'::regproc) as boleh_lihat_semua,
       pg_get_function_identity_arguments('private.boleh_lihat_po'::regproc) as boleh_lihat_po,
       (select count(*) from harga_paket) as n_paket,
       to_regclass('public.deklarasi_kesiapan') as deklarasi, to_regclass('public.verifikasi_otomatis') as verdict;
```

  Harapan: `boleh_lihat_semua` tanpa argumen, `boleh_lihat_po` satu argumen teks, 7 paket, dua
  tabel belum ada. Bila berbeda, BERHENTI dan laporkan.

- [ ] **Langkah 2: Tulis `supabase/migrasi/20260917b_verdict_iom.sql`:**

```sql
-- IoM Fase 2 bagian 1 (catatan/15 Tugas 1): verdict dihitung basis data sendiri.
--
-- Kenapa di basis data, bukan aplikasi (keputusan Rizki 17 Sep 2026, catatan/13 Fase 2):
-- verdict yang lolos membuka jalan ke `terverifikasi` tanpa empat persetujuan. RPC yang
-- menerima hasil dari aplikasi bisa dipanggil siapa pun lewat PostgREST dengan p_lolos=true.
-- Di sini tidak ada yang dikirim: trigger menilai dari data, dan tabelnya tanpa kebijakan tulis.

-- 1. Deklarasi kesiapan (13a Bagian 3). Baris baru per tanda tangan; yang berlaku = terakhir.
create table if not exists deklarasi_kesiapan (
  produk text not null,
  versi_produk text not null,
  butir text[] not null,
  berlaku_sampai date not null,
  ditandatangani_oleh text not null,
  ditandatangani_pada timestamptz not null,
  primary key (produk, versi_produk)
);
alter table deklarasi_kesiapan enable row level security;
revoke all on deklarasi_kesiapan from anon, authenticated;
grant select on deklarasi_kesiapan to authenticated;
drop policy if exists deklarasi_kesiapan_lihat on deklarasi_kesiapan;
create policy deklarasi_kesiapan_lihat on deklarasi_kesiapan for select to authenticated
  using (private.boleh_lihat_semua());

-- Tujuh deklarasi yang ditandatangani Rizki 17 Sep 2026 (13a Bagian 3), ditulis satu per satu:
-- paket di harga_paket yang TIDAK dideklarasikan tidak boleh ikut terisi.
insert into deklarasi_kesiapan (produk, versi_produk, butir, berlaku_sampai, ditandatangani_oleh, ditandatangani_pada)
select p.produk, '1', array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4'], date '2027-03-17',
       (select lower(email) from pengguna where 'head_of_operations' = any(peran) and aktif order by email limit 1),
       timestamptz '2026-09-17 00:00:00+07'
  from (values ('LMS Juara'), ('LMS Smart'), ('LMS Lite'), ('Bimbel UTBK/TKA Premium'),
               ('Bimbel UTBK/TKA Lite'), ('Asesmen Psikologi'), ('Tryout')) as p(produk)
on conflict (produk, versi_produk) do nothing;

-- 2. Verdict. Hanya bertambah, tidak pernah disunting: yang berlaku = baris terakhir per PO.
create table if not exists verifikasi_otomatis (
  id uuid primary key default gen_random_uuid(),
  po_id uuid not null references po(id) on delete cascade,
  versi_po int not null,
  versi_iom text not null,
  lolos boolean not null,
  paket text,
  gagal text[] not null default '{}',
  hasil jsonb not null,
  dicatat_pada timestamptz not null default clock_timestamp()
);
create index if not exists verifikasi_otomatis_po on verifikasi_otomatis (po_id, dicatat_pada desc);
alter table verifikasi_otomatis enable row level security;
revoke all on verifikasi_otomatis from anon, authenticated;
grant select on verifikasi_otomatis to authenticated;
drop policy if exists verifikasi_otomatis_lihat on verifikasi_otomatis;
create policy verifikasi_otomatis_lihat on verifikasi_otomatis for select to authenticated
  using (exists (select 1 from po p where p.id = verifikasi_otomatis.po_id and private.boleh_lihat_po(p.dibuat_oleh)));

-- 3. Mesin aturan. Kode aturan HARUS sama dengan lib/iom.ts (uji/verdict-iom.test.mjs).
create or replace function private.aturan_iom(p_kode text, p_lolos boolean, p_bukti text)
returns jsonb language sql immutable set search_path = public
as $$ select jsonb_build_object('kode', p_kode, 'lolos', coalesce(p_lolos, false), 'bukti', coalesce(p_bukti, '')) $$;

create or replace function private.nilai_iom(p_po uuid)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
  v po%rowtype;
  h jsonb := '[]';
  v_hari date := (now() at time zone 'Asia/Jakarta')::date;
  v_ids text[]; v_asing text[]; v_langgar text[]; v_kurang text[]; v_gagal text[];
  v_n int; v_total bigint; v_kelompok int;
  v_paket harga_paket%rowtype; v_ada_paket boolean;
  d deklarasi_kesiapan%rowtype; v_ada_d boolean := false; v_butir_kurang text[] := '{}';
  v_bukti_paket text; v_masa text;
begin
  select * into v from po where id = p_po;
  if not found then raise exception 'PO % tidak ditemukan.', p_po; end if;

  -- ---- 13a Bagian 1 dan 2 ----
  h := h || private.aturan_iom('po-berstempel-iom', v.versi_iom is not null,
    coalesce('dibuat di bawah ' || v.versi_iom, 'PO dibuat sebelum IoM berlaku'));
  h := h || private.aturan_iom('sekolah-terisi', coalesce(btrim(v.sekolah_beku ->> 'nama'), '') <> '',
    coalesce(nullif(btrim(v.sekolah_beku ->> 'nama'), ''), 'nama sekolah kosong'));

  select coalesce(array_agg(distinct komponen_id order by komponen_id), '{}') into v_ids
    from po_komponen where po_id = p_po;
  select coalesce(array_agg(distinct pk.komponen_id order by pk.komponen_id), '{}') into v_asing
    from po_komponen pk
   where pk.po_id = p_po and not exists (select 1 from harga_komponen hk where hk.id = pk.komponen_id);
  h := h || private.aturan_iom('komponen-dikenal', cardinality(v_ids) > 0 and cardinality(v_asing) = 0,
    case when cardinality(v_asing) > 0 then 'tidak dikenal: ' || array_to_string(v_asing, ', ')
         when cardinality(v_ids) > 0 then 'semua dikenal' else 'tanpa komponen' end);
  h := h || private.aturan_iom('jumlah-siswa-minimal', v.jumlah_siswa >= 1, v.jumlah_siswa || ' siswa');

  -- MIN_PESERTA (salinan lib/aturan-komponen.ts)
  select coalesce(array_agg(format('%s minimal %s %s, sekarang %s.', a.id, a.n, a.per,
           case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end) order by a.id), '{}')
    into v_langgar
    from po_komponen pk
    join harga_komponen hk on hk.id = pk.komponen_id
    join (values ('live', 30, 'siswa'), ('pmOn', 30, 'siswa'), ('pendam', 30, 'siswa'), ('psiOn', 10, 'siswa'),
                 ('psiOff', 10, 'siswa'), ('guruOff', 10, 'guru'), ('guruOn', 10, 'guru')) as a(id, n, per)
      on a.id = pk.komponen_id
   where pk.po_id = p_po
     and (case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end) < a.n;
  h := h || private.aturan_iom('minimal-peserta', cardinality(v_langgar) = 0,
    coalesce(nullif(array_to_string(v_langgar, ' '), ''), 'terpenuhi'));

  -- KAPASITAS_SESI (salinan lib/aturan-komponen.ts)
  select coalesce(array_agg(format('%s butuh minimal %s sesi, sekarang %s.', a.id,
           ceil((case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end)::numeric / a.n)::int,
           greatest(1, pk.sesi)) order by a.id), '{}')
    into v_langgar
    from po_komponen pk
    join harga_komponen hk on hk.id = pk.komponen_id
    join (values ('psiOff', 30, 'siswa'), ('psiOn', 30, 'siswa'), ('guruOff', 30, 'guru'), ('guruOn', 30, 'guru')) as a(id, n, per)
      on a.id = pk.komponen_id
   where pk.po_id = p_po
     and ceil((case a.per when 'guru' then v.jumlah_guru else v.jumlah_siswa end)::numeric / a.n) > greatest(1, pk.sesi);
  h := h || private.aturan_iom('kapasitas-sesi', cardinality(v_langgar) = 0,
    coalesce(nullif(array_to_string(v_langgar, ' '), ''), 'terpenuhi'));

  select count(*), coalesce(sum(nominal), 0) into v_n, v_total from po_termin where po_id = p_po;
  h := h || private.aturan_iom('termin-sama-total', v_n > 0 and v_total = v.grand_total,
    case when v_n > 0 then format('total termin %s, grand total %s', v_total, v.grand_total) else 'tanpa termin' end);

  if v.asal = 'unggahan' then
    h := h || private.aturan_iom('unggahan-ditinjau', v.berkas_unggahan is not null and v.ditinjau_pada is not null,
      case when v.berkas_unggahan is null then 'pindaian belum ada'
           when v.ditinjau_pada is null then 'belum ada pernyataan sesuai pindaian'
           else 'ditinjau ' || v.ditinjau_pada end);
  end if;

  v_masa := format('%s s.d. %s', coalesce(v.masa_mulai::text, '-'), coalesce(v.masa_selesai::text, '-'));
  h := h || private.aturan_iom('masa-aktif-lengkap', v.masa_mulai is not null and v.masa_selesai is not null, v_masa);
  h := h || private.aturan_iom('masa-aktif-wajar',
    v.masa_mulai is not null and v.masa_selesai is not null and v.masa_selesai > v.masa_mulai, v_masa);

  select coalesce(array_agg(t.k order by t.o), '{}') into v_kurang
    from unnest(array['npsn', 'kepala_sekolah', 'kepsek_hp', 'bendahara', 'bendahara_hp']) with ordinality as t(k, o)
   where coalesce(btrim(v.sekolah_beku ->> t.k), '') = '';
  h := h || private.aturan_iom('sekolah-lengkap', cardinality(v_kurang) = 0,
    case when cardinality(v_kurang) > 0 then 'kosong: ' || array_to_string(v_kurang, ', ') else 'lengkap' end);

  -- ---- 13a Bagian 4 dan 7 ----
  select count(*) into v_kelompok from po_kelompok where po_id = p_po;
  h := h || private.aturan_iom('satu-kelompok', v_kelompok < 2, v_kelompok || ' baris kelompok');

  select hp.* into v_paket from harga_paket hp
   where (select array_agg(distinct x order by x) from unnest(hp.ids) x) = v_ids
   limit 1;
  v_ada_paket := found;
  v_bukti_paket := case when v_ada_paket then v_paket.nama
    else 'susunan komponen bukan paket persis (a la carte, add-on, atau pelatihan guru)' end;
  h := h || private.aturan_iom('paket-persis', v_ada_paket, v_bukti_paket);
  h := h || private.aturan_iom('layanan-sesuai-paket', v_ada_paket, v_bukti_paket);

  if v_ada_paket then
    select * into d from deklarasi_kesiapan where produk = v_paket.nama
     order by ditandatangani_pada desc limit 1;
    v_ada_d := found;
  end if;
  if v_ada_d then
    select coalesce(array_agg(t.b order by t.o), '{}') into v_butir_kurang
      from unnest(array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4']) with ordinality as t(b, o)
     where not (t.b = any(d.butir));
  end if;
  h := h || private.aturan_iom('deklarasi-berlaku',
    v_ada_d and d.berlaku_sampai >= v_hari and cardinality(v_butir_kurang) = 0,
    case when not v_ada_d then 'tidak ada deklarasi untuk paket ini'
         when d.berlaku_sampai < v_hari then 'kedaluwarsa ' || d.berlaku_sampai
         when cardinality(v_butir_kurang) > 0 then 'butir belum dideklarasikan: ' || array_to_string(v_butir_kurang, ', ')
         else 'berlaku sampai ' || d.berlaku_sampai end);

  h := h || private.aturan_iom('lantai-siswa', v_ada_paket and v.harga_siswa >= v_paket.bottom,
    case when v_ada_paket then format('harga %s, bottom %s', v.harga_siswa, v_paket.bottom)
         else 'tidak dinilai tanpa paket persis' end);
  h := h || private.aturan_iom('lantai-guru',
    not exists (select 1 from po_komponen pk join harga_komponen hk on hk.id = pk.komponen_id
                 where pk.po_id = p_po and hk.untuk_guru),
    'pelatihan guru membuat PO dinilai manual');
  h := h || private.aturan_iom('tanpa-diskon', v_ada_paket and v.harga_siswa >= v_paket.price_list,
    case when v_ada_paket then format('harga %s, price list %s', v.harga_siswa, v_paket.price_list)
         else 'tidak dinilai tanpa paket persis' end);
  h := h || private.aturan_iom('tanpa-pengecualian-hoo',
    not exists (select 1 from po_pengecualian where po_id = p_po), 'pengecualian lantai HoO');
  h := h || private.aturan_iom('tanpa-sponsorship',
    not exists (select 1 from po_catatan where po_id = p_po and jenis = 'sponsorship' and btrim(coalesce(isi, '')) <> ''),
    'catatan sponsorship');
  h := h || private.aturan_iom('tanpa-permintaan-tambahan', not v.permintaan_tambahan, 'permintaan di luar paket');

  select coalesce(array_agg(t.e ->> 'kode' order by t.o), '{}') into v_gagal
    from jsonb_array_elements(h) with ordinality as t(e, o)
   where not (t.e ->> 'lolos')::boolean;
  return jsonb_build_object('versi_iom', private.versi_iom_berlaku(), 'lolos', cardinality(v_gagal) = 0,
    'paket', case when v_ada_paket then v_paket.nama end, 'gagal', to_jsonb(v_gagal), 'hasil', h);
end $$;

-- 4. Verdict dicatat saat PO MASUK verifikasi. Fail-closed, dan tidak pernah menghalangi.
create or replace function private.catat_verdict_iom()
returns trigger language plpgsql security definer set search_path = public
as $$
declare v jsonb;
begin
  if new.status <> 'verifikasi' or old.status = 'verifikasi' then return null; end if;
  begin
    v := private.nilai_iom(new.id);
  exception when others then
    v := jsonb_build_object('lolos', false, 'paket', null, 'gagal', jsonb_build_array('galat-evaluasi'),
      'hasil', jsonb_build_array(private.aturan_iom('galat-evaluasi', false, sqlerrm)));
  end;
  insert into verifikasi_otomatis (po_id, versi_po, versi_iom, lolos, paket, gagal, hasil)
  values (new.id, new.versi, private.versi_iom_berlaku(), (v ->> 'lolos')::boolean, v ->> 'paket',
          array(select jsonb_array_elements_text(v -> 'gagal')), v -> 'hasil');
  return null;
end $$;

drop trigger if exists po_verdict_iom on po;
create trigger po_verdict_iom after update of status on po
  for each row execute function private.catat_verdict_iom();
```

- [ ] **Langkah 3: Tulis penjaga** `uji/verdict-iom.test.mjs` (bagian Tugas 1):

```js
// Verdict IoM di basis data (catatan/15). Perilakunya dibuktikan di produksi dalam transaksi
// yang dibatalkan; uji ini menjaga yang bisa diperiksa tanpa koneksi: kode aturan SQL sama
// dengan lib/iom.ts, salinan aturan komponen sama, dan tidak ada jalan tulis ke tabel verdict.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const baca = (n) => readFileSync(new URL(`../supabase/migrasi/${n}`, import.meta.url), 'utf8');
const sql = baca('20260917b_verdict_iom.sql');
const ts = readFileSync(new URL('../lib/iom.ts', import.meta.url), 'utf8');
const { BUTIR_DEKLARASI } = muat('iom');
const { MIN_PESERTA, KAPASITAS_SESI } = muat('aturan-komponen');
const { PRESET } = muat('pricelist');
let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const kodeTs = new Set([...ts.matchAll(/cek\('([a-z-]+)'/g)].map((m) => m[1]));
const kodeSql = new Set([...sql.matchAll(/aturan_iom\('([a-z-]+)'/g)].map((m) => m[1]));
kodeSql.delete('galat-evaluasi');
assert.deepEqual([...kodeSql].sort(), [...kodeTs].sort());
ok(`${kodeTs.size} kode aturan SQL sama dengan lib/iom.ts`);

const daftar = (penanda) => {
  const blok = sql.slice(sql.indexOf(`-- ${penanda}`));
  const nilai = blok.slice(blok.indexOf('(values'), blok.indexOf(') as a(id, n, per)'));
  return Object.fromEntries([...nilai.matchAll(/\('(\w+)', (\d+), '(siswa|guru)'\)/g)]
    .map((m) => [m[1], { n: Number(m[2]), per: m[3] }]));
};
assert.deepEqual(daftar('MIN_PESERTA'), MIN_PESERTA);
assert.deepEqual(daftar('KAPASITAS_SESI'), KAPASITAS_SESI);
ok('salinan MIN_PESERTA dan KAPASITAS_SESI sama dengan lib/aturan-komponen.ts');

const butirSql = [...sql.matchAll(/array\['a1'[^\]]*\]/g)].map((m) => m[0]);
assert.equal(butirSql.length, 2);
for (const b of butirSql) assert.equal(b, `array[${BUTIR_DEKLARASI.map((x) => `'${x}'`).join(',')}]`);
ok('daftar butir di seed dan di mesin sama dengan BUTIR_DEKLARASI');

const produk = [...sql.slice(sql.indexOf('(values (\'LMS Juara\')')).matchAll(/\('([^']+)'\)/g)].slice(0, 7).map((m) => m[1]);
assert.deepEqual(produk.slice().sort(), PRESET.map((p) => p.n).sort());
ok('tujuh deklarasi yang diisi = tujuh paket di lib/pricelist.ts');

assert.match(sql, /revoke all on verifikasi_otomatis from anon, authenticated;/);
assert.doesNotMatch(sql, /policy [^;]* on verifikasi_otomatis for (insert|update|delete|all)/);
assert.match(sql, /revoke all on deklarasi_kesiapan from anon, authenticated;/);
assert.doesNotMatch(sql, /policy [^;]* on deklarasi_kesiapan for (insert|update|delete|all)/);
ok('tabel verdict dan deklarasi tanpa jalan tulis untuk klien');

assert.match(sql, /create trigger po_verdict_iom after update of status on po/);
assert.match(sql, /exception when others then/);
assert.match(sql, /order by ditandatangani_pada desc limit 1/);
assert.match(sql, /now\(\) at time zone 'Asia\/Jakarta'/);
ok('verdict dicatat saat masuk verifikasi, fail-closed, deklarasi terakhir, zona Jakarta');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 4:** `node --test uji/verdict-iom.test.mjs` dan `npm run periksa`. Harapan: lolos.

- [ ] **Langkah 5: Bukti di produksi, DIBATALKAN.** Satu panggilan `execute_sql`: set klaim JWT ke akun
  sales (`'sales' = any(peran)` dan bukan `admin_utama`), isi migrasi Langkah 2, lalu:

```sql
create function pg_temp.po_dasar(p_komponen text[], p_harga bigint, p_siswa int default 100,
  p_asal text default 'platform', p_nama text default 'SMA UJI VERDICT', p_bendahara_hp text default '0801')
returns uuid language plpgsql as $$
declare v_sek uuid; v_po uuid; k text;
begin
  insert into sekolah (nama, npsn, jenjang, kepala_sekolah, kepsek_hp, bendahara, bendahara_hp)
  values (p_nama, '8' || lpad((floor(random() * 1e7))::int::text, 7, '0'), 'SMA', 'Kepala Uji', '0800', 'Bendahara Uji', p_bendahara_hp)
  returning id into v_sek;
  insert into po (sekolah_id, dibuat_oleh, jumlah_siswa, harga_siswa, grand_total, masa_mulai, masa_selesai, asal)
  values (v_sek, auth.jwt() ->> 'email', p_siswa, p_harga, p_harga * p_siswa, '2026-10-01', '2027-09-30', p_asal)
  returning id into v_po;
  foreach k in array p_komponen loop
    insert into po_komponen (po_id, komponen_id, sesi, kelompok) values (v_po, k, 1, 1);
  end loop;
  insert into po_termin (po_id, urutan, tanggal, nominal) values (v_po, 1, '2026-10-05', p_harga * p_siswa);
  return v_po;
end $$;
```

  Lalu satu blok `do` yang untuk setiap kasus membuat PO dengan `pg_temp.po_dasar`, merusak satu hal,
  memanggil `private.nilai_iom(po)`, dan mencatat `(kasus, sesuai, gagal)`, diakhiri
  `raise exception 'HASIL_VERDICT sesuai %/% %'`. Dasar `SMART` = `array['lms','modul','soal','video']`,
  harga 240000 (price list LMS Smart; bottom 135000). Kasus dan harapan:

| # | Kasus | Perusakan | Harapan |
|---|---|---|---|
| 0 | dasar | tidak ada | `lolos`, `paket` = LMS Smart, `gagal` kosong |
| 1 | po-berstempel-iom | `alter table po disable trigger po_syarat_maju`, `update po set versi_iom = null`, aktifkan lagi | gagal memuat kode |
| 2 | sekolah-terisi | `p_nama => '  '` | memuat kode |
| 3 | komponen-dikenal | sisip `po_komponen` `'hantu'` | memuat kode |
| 4 | jumlah-siswa-minimal | `jumlah_siswa = 0, grand_total = 0`, termin 0 | memuat kode |
| 5 | minimal-peserta | LMS Juara (`lms,modul,video,soal,asesmen,tryout,live,snbp`), 350000, `p_siswa => 10` | memuat kode |
| 6 | kapasitas-sesi | sisip `psiOff` sesi 1 | memuat kode |
| 7 | termin-sama-total | hapus termin; dan terpisah: nominal 1 | memuat kode (dua kasus) |
| 8 | unggahan-ditinjau | `p_asal => 'unggahan'`, `berkas_unggahan = 'x/po.pdf'` | memuat kode |
| 9 | masa-aktif-lengkap | `masa_selesai = null` | memuat kode |
| 10 | masa-aktif-wajar | `masa_selesai = masa_mulai` | memuat kode |
| 11 | sekolah-lengkap | `p_bendahara_hp => ''` | memuat kode |
| 12 | satu-kelompok | sisip `po_kelompok` nomor 1 dan 2 harga 240000 | memuat kode |
| 13 | paket-persis + lantai-guru | sisip `guruOff`, `jumlah_guru = 10` | memuat keduanya |
| 14 | layanan-sesuai-paket | `array['lms','modul']` | memuat kode |
| 15 | tanpa-diskon | harga 239999 | memuat kode, tidak memuat lantai-siswa |
| 16 | lantai-siswa | harga 134999 | memuat kode |
| 17 | tanpa-pengecualian-hoo | `p_asal => 'unggahan'`, harga 134999, klaim JWT diganti HoO, sisip `po_pengecualian (po_id, alasan)`, klaim dikembalikan | memuat kode |
| 18 | tanpa-sponsorship | sisip `po_catatan` sponsorship `'10% ke sekolah'` | memuat kode |
| 19 | tanpa-permintaan-tambahan | `permintaan_tambahan = true` | memuat kode |
| 20 | trigger ujung ke ujung | PO dasar; sebagai `authenticated` sales: status `menunggu_ttd`, `ditandatangani`, `verifikasi`; `reset role` | satu baris `verifikasi_otomatis`, `lolos`, `versi_po` = `po.versi`, `versi_iom` = `iom-2026-09-17b` |
| 21 | tulis langsung | sebagai sales: `insert into verifikasi_otomatis` | ditolak |
| 22 | panggil mesin | sebagai sales: `select private.nilai_iom(po)` | ditolak (izin skema) |
| 23 | deklarasi kedaluwarsa | sisip deklarasi LMS Smart versi `'2'`, berlaku kemarin (Jakarta), `ditandatangani_pada` `2026-09-18` | dasar memuat `deklarasi-berlaku` |
| 24 | deklarasi butir kurang | versi `'3'`, 9 butir, `2026-09-19` | memuat `deklarasi-berlaku` |
| 25 | deklarasi berlaku hari ini | versi `'4'`, berlaku hari ini (Jakarta), 10 butir, `2026-09-20` | dasar `lolos` |

  Kasus 23-25 dijalankan paling akhir karena mengubah deklarasi LMS Smart.

  > **Temuan saat eksekusi 17 Sep 2026:** putaran pertama 25/27. Kasus 22 menunjukkan akun sales BISA
  > memanggil `private.nilai_iom` (izin EXECUTE bawaan PUBLIC di skema private). Migrasi ditambah
  > bagian 5: `revoke all` atas `nilai_iom`, `aturan_iom`, `catat_verdict_iom` dari `public, anon,
  > authenticated`, dijaga `uji/verdict-iom.test.mjs`. Kasus 17 gagal karena data uji: kolom
  > `po_pengecualian.pelanggaran` wajib diisi. Harapan: seluruh kasus sesuai.
  Bila status `menunggu_ttd -> ditandatangani` sebagai sales ditolak sesuatu di basis data, lakukan
  lompatan itu sebagai postgres dan catat alasannya.

- [ ] **Langkah 6: Mutasi** (dibatalkan): (a) ganti `v_total = v.grand_total` jadi `true` → kasus 7b
  harus berubah tidak memuat kode; (b) ganti `d.berlaku_sampai >= v_hari` jadi `d.berlaku_sampai > v_hari`
  → kasus 25 harus berubah tidak lolos. Bila salah satu tidak berubah, kasusnya tidak menjaga: perbaiki.

- [ ] **Langkah 7: Commit.**

```bash
git add supabase/migrasi/20260917b_verdict_iom.sql uji/verdict-iom.test.mjs
git commit -m "IoM Fase 2 1/4: mesin aturan SQL, deklarasi, trigger verdict (belum diterapkan)"
```

---

### Tugas 2: Penutupan satu klik Head of Operations

- [ ] **Langkah 1: Tulis `supabase/migrasi/20260917c_tutup_verifikasi_otomatis.sql`:**

```sql
-- IoM Fase 2 bagian 2 (catatan/15 Tugas 2): PO yang lolos otomatis ditutup Head of Operations
-- dengan satu klik. Isi jaga_penutupan_verifikasi disalin dari definisi hidup 17 Sep 2026;
-- yang ditambahkan hanya cabang jalur IoM.

create or replace function private.jaga_penutupan_verifikasi()
returns trigger language plpgsql set search_path = public
as $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then return NEW; end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak from verifikasi where po_id = NEW.id and berlaku;
  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    -- Jalur IoM: tanpa empat persetujuan, HANYA Head of Operations, tanpa satu pun penolakan,
    -- dan verdict TERAKHIR lolos untuk versi PO ini dan versi IoM yang berlaku.
    if tolak > 0 or not private.punya_peran('head_of_operations') or not exists (
         select 1 from (select lolos, versi_po, versi_iom from verifikasi_otomatis
                         where po_id = NEW.id order by dicatat_pada desc limit 1) t
          where t.lolos and t.versi_po = NEW.versi and t.versi_iom = private.versi_iom_berlaku())
    then
      raise exception 'Belum bisa dinyatakan terverifikasi: % dari 4 fungsi setuju, % menolak.', hijau, tolak;
    end if;
  end if;
  if NEW.status = 'ditolak' and tolak = 0 then
    raise exception 'Tidak ada fungsi yang menolak, jadi PO ini tidak bisa ditutup sebagai ditolak.';
  end if;
  return NEW;
end $$;

-- Jalan HoO. Syarat verdict ditegakkan trigger di atas, bukan di sini, supaya satu tempat saja.
create or replace function public.tutup_verifikasi_otomatis(p_po uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_po po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if not private.punya_peran('head_of_operations') then
    raise exception 'Hanya Head of Operations yang bisa menutup PO yang lolos verifikasi otomatis.'
      using errcode = 'check_violation';
  end if;
  select * into v_po from po where id = p_po for update;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_po.status <> 'verifikasi' then
    raise exception 'PO tidak sedang dalam tahap verifikasi.' using errcode = 'check_violation';
  end if;
  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Pembuat PO tidak boleh menutup verifikasinya sendiri.' using errcode = 'check_violation';
  end if;
  update po set status = 'terverifikasi', diverifikasi_oleh = v_saya, diverifikasi_pada = now()
   where id = p_po;
end $$;

revoke all on function tutup_verifikasi_otomatis(uuid) from public, anon;
grant execute on function tutup_verifikasi_otomatis(uuid) to authenticated;
```

- [ ] **Langkah 2: Tambah penjaga** di akhir `uji/verdict-iom.test.mjs`, sebelum baris `console.log` terakhir:

```js
const tutup = baca('20260917c_tutup_verifikasi_otomatis.sql');
assert.match(tutup, /tolak > 0 or not private\.punya_peran\('head_of_operations'\)/);
assert.match(tutup, /order by dicatat_pada desc limit 1\) t\s+where t\.lolos and t\.versi_po = NEW\.versi and t\.versi_iom = private\.versi_iom_berlaku\(\)/);
assert.match(tutup, /NEW\.status = 'ditolak' and tolak = 0/);
assert.match(tutup, /lower\(v_po\.dibuat_oleh\) = v_saya/);
assert.match(tutup, /revoke all on function tutup_verifikasi_otomatis\(uuid\) from public, anon;/);
ok('penutupan IoM: hanya HoO, nol penolakan, verdict terakhir untuk versi ini, bukan pembuat');
```

- [ ] **Langkah 3:** `node --test uji/verdict-iom.test.mjs`, `npm run periksa`. Harapan: lolos.

- [ ] **Langkah 4: Bukti, DIBATALKAN.** Satu panggilan: isi kedua migrasi, `pg_temp.po_dasar`, lalu kasus.
  Tiga identitas lewat `set_config('request.jwt.claims', ...)`: SALES (pembuat), HOO
  (`'head_of_operations' = any(peran)`), LEAD (`'tech_ops_lead' = any(peran)`). Setiap PO dibawa ke
  `verifikasi` oleh SALES sebagai `authenticated` (verdict tercatat trigger), lalu:

| # | Kasus | Harapan |
|---|---|---|
| T1 | HOO memanggil `tutup_verifikasi_otomatis` pada PO dasar | `terverifikasi`, `diverifikasi_oleh` = email HOO |
| T2 | LEAD memanggil RPC pada PO dasar lain | ditolak "Hanya Head of Operations" |
| T3 | LEAD `update po set status = 'terverifikasi'` langsung | ditolak "Belum bisa dinyatakan terverifikasi" |
| T4 | HOO pada PO dengan sponsorship (verdict gagal) | ditolak |
| T5 | HOO pada PO dasar yang punya satu `verifikasi` `tolak` berlaku (disisipkan sebagai postgres, `oleh` = HOO) | ditolak |
| T6 | HOO pada PO dasar sesudah `update po set versi = versi + 1` sebagai postgres | ditolak |
| T7 | HOO pada PO yang dibuat HOO sendiri | ditolak "Pembuat PO" |
| T8 | Jalur lama: PO verdict gagal + empat `verifikasi` setuju (sisip postgres), LEAD update ke `terverifikasi` | berhasil |
| T9 | Jalur tolak tidak berubah: LEAD update ke `ditolak` tanpa penolakan | ditolak |
| T10 | anon: `set local role anon`, panggil RPC | ditolak (izin) |

  Harapan: 10/10 sesuai. Mutasi (dibatalkan): hapus `not private.punya_peran('head_of_operations') or`
  → T3 harus berubah berhasil; hapus `and t.versi_po = NEW.versi` → T6 harus berubah berhasil.

- [ ] **Langkah 5: Commit.**

```bash
git add supabase/migrasi/20260917c_tutup_verifikasi_otomatis.sql uji/verdict-iom.test.mjs
git commit -m "IoM Fase 2 2/4: penutupan satu klik Head of Operations (belum diterapkan)"
```

---

### Tugas 3: QA independen SEBELUM diterapkan

> **QA putaran 1 (17 Sep 2026): FAIL, satu MAJOR, dibuktikan QA di produksi (dibatalkan).**
> 1. MAJOR: RLS `po_ubah` membolehkan pemilik melompat `draf -> verifikasi` lewat satu UPDATE;
>    syarat tiga tanda tangan hanya di aplikasi. Dengan jalur IoM, PO tanpa tanda tangan bisa
>    ditutup satu klik. **Perbaikan:** migrasi baru `20260917d_urutan_status_po.sql` (trigger
>    `po_urutan_status`): `ditandatangani` hanya dari `menunggu_ttd`, atau dari draf/ditolak untuk
>    PO unggahan berpindaian dengan sidik tinjauan yang masih cocok; `verifikasi` hanya dari
>    `ditandatangani` dengan tiga pihak bertanda tangan.
> 2. MINOR: `punya_peran` meloloskan admin_utama, jadi Super Admin tanpa peran HoO bisa memakai
>    jalur "HoO saja" dan namanya tercetak di Surat. **Perbaikan:** cek peran harfiah
>    `'head_of_operations' = any(private.peran_saya())` di trigger dan RPC (pola yang sama dengan
>    `c_level`), sesuai keputusan "hanya Head of Operations".
> 3. MINOR: penutupan tidak memeriksa ulang deklarasi yang kedaluwarsa atau ditandatangani ulang
>    sesudah verdict. **Perbaikan:** trigger penutupan memeriksa deklarasi TERAKHIR paket verdict
>    masih berlaku (zona Jakarta) dan memuat sepuluh butir.
> 4. MINOR (diterima): uji statis hanya memeriksa teks; bukti perilaku tetap transaksi dibatalkan.
>    NIT (diterima, pola proyek): `btrim` SQL vs `.trim()` JS; `search_path` tanpa `pg_temp`.
>
> **QA putaran 2 (17 Sep 2026): FAIL, dua MAJOR di `20260917d`, dibuktikan QA (dibatalkan).**
> 1. MAJOR: tanda tangan putaran lama terbawa. PO yang ditolak, disunting, lalu dikirim ulang
>    tetap punya tiga baris `tanda_tangan` lama, jadi bisa masuk `verifikasi` dan ditutup satu klik
>    tanpa sekolah menandatangani isi yang sekarang. **Perbaikan:** masuk `menunggu_ttd` dari
>    draf/ditolak menghapus tanda tangan putaran lama (pola `kembalikanKeDraf` dan
>    `ajukan_po_unggahan`); lompatan PO unggahan ke `ditandatangani` juga menghapusnya.
> 2. MAJOR: PO unggahan melewati cek sidik lewat `menunggu_ttd`. **Perbaikan:**
>    `menunggu_ttd -> ditandatangani` hanya untuk `asal = 'platform'`.
> 3. NIT diperbaiki: `menunggu_ttd -> ditandatangani` kini menuntut tiga pihak.
> Tindak lanjut Fase 3 (aplikasi): berkas gambar tanda tangan putaran lama di storage tidak ikut
> terhapus oleh trigger; `kirimUntukTtd` perlu menghapus `{id}/{pihak}.png` seperti
> `kembalikanKeDraf`, sesudah lompatan status berhasil.

- [ ] **Langkah 1:** Agen QA terpisah. Brief: tinjau kedua migrasi dan `uji/verdict-iom.test.mjs`
  terhadap `catatan/13a` Bagian 1-7, `catatan/13` Fase 2 (keputusan 17 Sep), dan `lib/iom.ts`
  (kesamaan perilaku tiap aturan, bukan hanya kodenya); cari jalan memalsukan verdict atau menutup
  PO tanpa syarat (kebijakan RLS `po`, fungsi SECURITY DEFINER lain yang mengubah `po.status` atau
  menulis `verifikasi_otomatis`); boleh membuktikan dengan panggilan `execute_sql` yang diakhiri
  `raise exception`; DILARANG `apply_migration`, DML/DDL yang tersimpan, membaca isi `.env*`,
  commit, atau deploy. Perbaiki temuan BLOCKER/MAJOR, ulangi bukti Tugas 1-2 yang terdampak, ulangi
  QA sampai PASS.

---

### Tugas 4: Terapkan ke produksi (GERBANG PERSETUJUAN)

- [ ] **Langkah 1:** Minta "ya" eksplisit Rizki dengan ringkasan: dua tabel, tujuh deklarasi, mesin,
  trigger verdict, amandemen penutupan, RPC; hasil bukti, mutasi, dan QA.
- [ ] **Langkah 2:** `apply_migration` `20260917b_verdict_iom` lalu `20260917c_tutup_verifikasi_otomatis`,
  isi persis berkasnya.
- [ ] **Langkah 3: Bukti ulang hidup, DIBATALKAN:** kasus 0, 20, 21 Tugas 1 dan T1-T3, T7-T9 Tugas 2
  tanpa DDL. Harapan: semua sesuai.
- [ ] **Langkah 4: Periksa produksi:**

```sql
select (select count(*) from deklarasi_kesiapan) as deklarasi,
       (select count(*) from verifikasi_otomatis) as verdict,
       (select json_object_agg(status, n) from (select status, count(*) n from po group by status) s) as po;
```

  Harapan: 7 deklarasi, 0 verdict (PO yang sudah di `verifikasi` tidak dinilai surut), status PO tidak
  berubah. Lalu `get_advisors` security: tidak ada temuan baru yang menyebut objek baru selain
  `tutup_verifikasi_otomatis` (SECURITY DEFINER yang dapat dipanggil `authenticated`, disengaja, sama
  dengan RPC lain).

---

### Tugas 5: Catat

- [ ] **Langkah 1:** Status "Fase 2 tayang" + hasil QA di `catatan/13` Fase 2 dan kepala berkas ini;
  pengingat tanda tangan ulang deklarasi sebelum 17 Mar 2027 di `catatan/13` Fase 3.
- [ ] **Langkah 2:** Commit `"IoM Fase 2 4/4: diterapkan, QA, catatan"`. Push hanya bila Rizki meminta.

## Di luar lingkup (Fase 3)

- Antarmuka: kartu verdict di `po/[id]`, antrean `/verifikasi` otomatis vs manual, tombol "Tutup
  (lolos otomatis)" untuk HoO, tanda tangan Surat Verifikasi Kesiapan oleh HoO untuk PO otomatis
  (perluasan `leadSaatIni()`), layar tanda tangan ulang deklarasi.
- Menilai ulang PO yang sudah berstatus `verifikasi` sebelum trigger hidup (tidak dilakukan; PO lama
  memang selalu manual).
