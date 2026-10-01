# Rencana: Ekstraksi scan PO unggahan

> **Untuk agen pelaksana:** WAJIB memakai sub-skill superpowers:subagent-driven-development
> (disarankan) atau superpowers:executing-plans untuk menjalankan rencana ini tugas demi tugas.
> Langkah memakai kotak centang (`- [ ]`).

**Tujuan:** Pada jalur unggah, isian wizard terisi dari hasil baca scan oleh model vision, dan
Sales memeriksa, mengoreksi, lalu mengonfirmasi setiap langkah sebelum Tinjau terbuka. Yang
tersimpan tetap hanya yang dikonfirmasi Sales, dan PO hasil ekstraksi boleh lolos verifikasi
otomatis dengan jejak `po.dibaca_ai_pada` yang terlihat.

**Arsitektur:** Scan dibaca SEBELUM draf ada (amandemen 3): satu Server Action mengklaim baris di
`ekstraksi_po`, memanggil penyedia, lalu menulis hasilnya; PO baru dibuat oleh `simpanDraf` yang
sudah ada, lalu pembacaan ditautkan ke PO itu dan `po.dibaca_ai_pada` diisi. Pemetaan hasil model
ke isian wizard adalah fungsi murni `lib/ekstraksi-po.ts` yang TIDAK mengimpor pricelist (himpunan
`ids` paket disuntikkan pemanggil). Gerbang organisasi `pengaturan_ekstraksi` hanya dibaca dan
ditulis Super Admin, dan dipatuhi basis data maupun server.

**Tumpukan:** Next.js 16 App Router, TypeScript, `@supabase/ssr`, Postgres (Supabase
`lzamazdfaidxuohhzpjd`), `pdfjs-dist` di peramban, penyedia `deepseek-v4-flash-vision-exp` lewat
OpenCode Go, uji `node --test` di `uji/*.test.mjs`, Docker lewat Colima untuk basis data lokal.

**Spesifikasi:** `catatan/17-spesifikasi-ekstraksi-scan-po.md` (baca dulu; rencana ini berargumen
dari sana, termasuk ketiga amandemen 25 Sep 2026 di bagian akhir berkas). Latar jalur unggah:
`catatan/08-spesifikasi-po-unggahan.md`.

## Batasan global

- Repo di `~/Projects/Skolla/skolla-kerjasama`, cabang kerja **`build/ekstraksi-scan-po`** (sudah
  ada, berisi `catatan/17` diamandemen). Jangan membuat cabang baru.
- Setiap migrasi baru ditulis di `supabase/migrasi/<tanggal><huruf>_<nama>.sql` **dan** disalin
  byte-identik ke `supabase/migrations/<14 digit>_<nama>.sql` pada commit yang sama
  (`uji/rantai-migrasi.test.mjs` menolak berkas yatim).
- **Tidak ada satu pun penulisan ke produksi** (migrasi, data, deploy) sebelum Tugas 12, dan
  Tugas 12 hanya berjalan sesudah Rizki menyetujui secara eksplisit. Agen TIDAK bisa menjalankan
  `supabase db push`; Rizki yang menjalankannya dari direktori proyek.
- Kolom baru di `po` wajib masuk **KEDUA** tuple `private.bekukan_isi_po`, dan kolom yang muncul
  kosong di setiap baris wajib dikeluarkan dari `private.sidik_tinjauan` selama kosong.
- Uji yang membaca migrasi memakai `migrasiTerakhir(pola)` dari `uji/migrasi.mjs`, tidak pernah
  nama berkas yang dipatok.
- **Tidak ada PO asli di berkas uji mana pun.** Berkas golden dan fikstur hanya berisi PO rekaan
  (sekolah fiktif, nomor palsu). Panggilan penyedia sungguhan di uji hanya dengan data rekaan.
- `OPENCODE_GO_API_KEY` hanya di server, tidak pernah berawalan `NEXT_PUBLIC_`, tidak pernah
  dicetak, dan namanya tidak boleh muncul di chunk klien.
- Golden lama di `uji/emas/` **tidak boleh berubah**: ekstraksi tidak menyentuh satu bait pun
  dokumen. Selisih pada berkas lama = cacat.
- Teks layar dan dokumen baru tanpa em dash (`—`, `&mdash;`), sesuai `DESIGN.md`. Pengecualian
  yang sudah ada dipertahankan apa adanya.
- Pekerjaan tampilan: baca `DESIGN.md`, saring dengan skill antislop.
- Gerbang tiap tugas: `npm run periksa` hijau. Sesudah menghapus rute sementara: hapus `.next`
  (`.next/dev/types/validator.ts` yang tertinggal membuat `periksa` dan `build` sama-sama gagal).

## Keputusan rencana (diisi di sini karena spesifikasi menyerahkannya ke rencana)

1. **Status konfirmasi per langkah disimpan di `po.ekstraksi_menunggu text[]`** (amandemen 2
   butir 5). Isinya daftar KUNCI isian yang masih menunggu konfirmasi, bukan hasil baca AI, jadi
   membacanya tidak membocorkan apa pun yang belum diketahui Sales. Kolom ini penanda kemajuan
   layar, **bukan** isi dokumen: ia dikeluarkan dari `private.sidik_tinjauan` SELALU (bukan hanya
   saat kosong), karena ia ikut berubah saat Sales mencentang dan itu bukan perubahan isi PO.
   Gerbang "Tinjau" tetap seperti hari ini: `ditinjau_pada` + sidik, ditegakkan basis data.
2. **Himpunan `ids` paket disuntikkan, bukan diimpor.** `lib/ekstraksi-po.ts` menerima fungsi
   `idsPaket(nama) => string[] | null`. Kalau modul itu mengimpor `lib/pricelist.ts`, harga
   Acquisition ikut ke bundel klien dan `uji/batas-harga.test.mjs` menolaknya.
3. **Pemetaan rombel memakai `KELAS` dari `lib/kelas.ts`** (modul murni tanpa impor, memang
   dirancang untuk itu): label kertas `X`/`XI`/`XII` dan `10`/`11`/`12` diurai ke angka kelas
   jenjang yang sedang dipilih; baris di luar jenjang dibuang.
4. **Halaman Super Admin adalah rute baru `/ekstraksi`**, bukan tambahan di `/pengguna`: gerbang
   organisasi dan daftar pembacaan adalah pekerjaan pokok, sementara `/pengguna` mengurus akun.
   Menu hanya tampil untuk `admin_utama` (pola penyaring menu yang sudah ada di `app/(sistem)/menu.tsx`).
5. **Pembacaan gagal tidak menautkan apa pun.** `po_id` tetap kosong, `po.dibaca_ai_pada` tidak
   pernah diisi, dan draf tidak pernah lahir. Yang tersisa hanya baris klaim.
6. **Gambar dirender di peramban dengan `pdfjs-dist`,** dan worker-nya disalin ke
   `public/pdf.worker.min.mjs` serta **dikomit** (bukan disalin saat `postinstall`): satu berkas
   statis lebih tahan daripada langkah build yang bisa gagal diam-diam. Naikkan berkas itu saat
   `pdfjs-dist` diperbarui.

## Fokus tinjauan

1. **Gerbang mati berarti tidak ada yang berubah.** Tanpa baris `pengaturan_ekstraksi.menyala`:
   kotak "Baca scan" tidak tampil, `klaim_ekstraksi()` ditolak, dan jalur unggah berperilaku
   persis seperti sebelum pekerjaan ini. (Tugas 1 probe P1, Tugas 5, Tugas 6.)
2. **Percobaan yang ditinggalkan tidak meninggalkan jejak data pribadi.** Gagal baca: nol draf,
   nol berkas di bucket, `po_id` kosong. Yang tinggal hanya baris klaim, dan `hasil` mentahnya
   dikosongkan sesudah 24 jam. (Tugas 2 probe P4, Tugas 5.)
3. **Sales tidak bisa memalsukan jejaknya sendiri.** `dibaca_ai_pada` ditolak lewat PostgREST,
   baik mengisi maupun mengosongkan, dan tidak bisa berubah pada PO yang sudah diteken.
   (Tugas 1 probe P3.)
4. **Konfirmasi tidak bisa dilewati satu klik.** Tombol langkah mati selama centang berisiko di
   langkah itu belum lengkap; Tinjau mati sampai semua langkah dikonfirmasi; nomor HP selalu
   dituntut, termasuk saat Sales mengetik ulang nomornya. Status bertahan sesudah draf dibuka
   lagi. (Tugas 8.)
5. **Draf unggahan yang sudah dinyatakan sesuai sebelum migrasi tetap bisa diajukan.** Sidiknya
   harus tidak berubah oleh kolom baru. (Tugas 1 probe P9, Tugas 3 probe.)
6. **Harga Acquisition tidak ikut ke peramban** oleh modul dan kunci baru. (Tugas 5 langkah
   `pindai-bundel`.)

---

### Tugas 1: Migrasi gerbang dan penanda `dibaca_ai_pada`, dengan buktinya

**Berkas:**
- Buat: `supabase/migrasi/20260926a_gerbang_ekstraksi.sql`
- Buat: `supabase/migrations/20260926010000_gerbang_ekstraksi.sql` (salinan byte-identik)
- Buat: `uji/db-lokal/jalankan-bukti-ekstraksi.sh`
- Buat: `uji/db-lokal/bukti-gerbang-ekstraksi.sql`
- Uji: `uji/ekstraksi-migrasi.test.mjs`

**Antarmuka:**
- Menghasilkan (dipakai Tugas 2, 5, 9, 10):
  - kolom `po.dibaca_ai_pada timestamptz` (null = tidak dibaca AI).
  - tabel `pengaturan_ekstraksi(id, menyala, penyedia, paket_akun, model, pemeriksaan_data,
    risiko_diterima_oleh, alasan_risiko, diubah_oleh, diubah_pada)`.
  - setelan transaksi `app.penanda_ekstraksi` yang dikenali `po_jaga_penanda`.

- [ ] **Langkah 1: Tulis uji penjaga migrasi yang gagal**

`uji/ekstraksi-migrasi.test.mjs`:

```js
// Penjaga statis untuk migrasi ekstraksi (catatan/25). Bukan bukti perilaku — bukti perilakunya
// ada di uji/db-lokal/bukti-gerbang-ekstraksi.sql. Yang dijaga di sini adalah hal-hal yang
// gampang terlupa saat fungsi ditulis ulang: kolom baru masuk KEDUA tuple pembekuan, kolom baru
// dikeluarkan dari sidik, dan penanda baru punya penjaga.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const beku = migrasiTerakhir(/function private\.bekukan_isi_po/).isi;
assert.equal((beku.match(/dibaca_ai_pada/g) ?? []).length, 2,
  'dibaca_ai_pada harus ada di KEDUA tuple private.bekukan_isi_po');
ok('dibaca_ai_pada ikut dibekukan pada PO yang sudah keluar draf');

const penanda = migrasiTerakhir(/function private\.jaga_penanda_otomatis/).isi;
assert.match(penanda, /app\.penanda_ekstraksi/);
ok('po_jaga_penanda mengenal setelan app.penanda_ekstraksi');

const sidik = migrasiTerakhir(/function private\.sidik_tinjauan/).isi;
assert.match(sidik, /dibaca_ai_pada/);
ok('dibaca_ai_pada dikeluarkan dari sidik tinjauan');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/ekstraksi-migrasi.test.mjs`
Harapan: GAGAL pada asersi pertama (`dibaca_ai_pada` belum ada di migrasi mana pun).

- [ ] **Langkah 3: Tulis migrasinya**

`supabase/migrasi/20260926a_gerbang_ekstraksi.sql`:

```sql
-- Gerbang organisasi ekstraksi scan PO, dan penanda "dibaca AI" (catatan/17 amandemen 25 Sep 2026).
--
-- Dua hal berbeda dalam satu migrasi karena keduanya menyentuh `po` dan keduanya harus naik
-- bersama: kolom penanda dan penjaganya.
--
-- 1. Kolom po.dibaca_ai_pada. Kosong secara bawaan. Diisi HANYA oleh tautkan_ekstraksi()
--    (migrasi berikutnya) saat hasil baca berhasil ditautkan ke PO. Pembacaan yang gagal tidak
--    menandai apa pun: tidak ada isian yang diisi AI, jadi tidak ada yang perlu dilihat HoO.
alter table po add column if not exists dibaca_ai_pada timestamptz;

comment on column po.dibaca_ai_pada is
  'Waktu isian awal PO ini dibaca AI dari pindaian (catatan/17). Diisi tautkan_ekstraksi() saja, '
  'tidak pernah dari klien. Kosong = tidak ada isian dari AI.';

-- 2. Gerbang organisasi. Satu baris per perubahan; baris terakhir yang berlaku.
create table if not exists pengaturan_ekstraksi (
  id                    bigserial primary key,
  menyala               boolean not null default false,
  penyedia              text,
  paket_akun            text,
  model                 text,
  pemeriksaan_data      text,
  risiko_diterima_oleh  text,
  alasan_risiko         text,
  diubah_oleh           text not null,
  diubah_pada           timestamptz not null default now(),
  -- Menyalakan tanpa mencatat siapa yang menerima risikonya ditolak basis data, bukan hanya
  -- oleh layar (catatan/17 "Keputusan (Rizki)" soal DPA yang tidak ada).
  constraint gerbang_lengkap check (
    not menyala or (
      coalesce(btrim(penyedia), '') <> '' and coalesce(btrim(paket_akun), '') <> ''
      and coalesce(btrim(model), '') <> '' and coalesce(btrim(pemeriksaan_data), '') <> ''
      and coalesce(btrim(risiko_diterima_oleh), '') <> '' and coalesce(btrim(alasan_risiko), '') <> ''
    )
  ),
  -- Dijawab dari sesi, bukan dari isian; tanpa email tidak ada baris yang boleh lahir.
  constraint gerbang_oleh check (coalesce(btrim(diubah_oleh), '') <> '')
);

comment on table pengaturan_ekstraksi is
  'Riwayat gerbang ekstraksi scan PO (catatan/17). Baris terakhir = keadaan berlaku. '
  'Hanya Super Admin yang membaca dan menulis.';

alter table pengaturan_ekstraksi enable row level security;

drop policy if exists gerbang_baca on pengaturan_ekstraksi;
create policy gerbang_baca on pengaturan_ekstraksi for select to authenticated
  using ('admin_utama' = any (private.peran_saya()));

drop policy if exists gerbang_tulis on pengaturan_ekstraksi;
create policy gerbang_tulis on pengaturan_ekstraksi for insert to authenticated
  with check ('admin_utama' = any (private.peran_saya())
              and diubah_oleh = lower(auth.jwt() ->> 'email'));

-- Tidak ada policy UPDATE/DELETE: riwayat tidak boleh disunting. Perubahan keadaan = baris baru.

-- 3. Nama model dipaku di basis data, bukan diterima dari klien: setiap baris pembacaan mencatat
--    model yang benar-benar dipakai, dan klien tidak punya suara soal itu.
create or replace function private.model_ekstraksi()
returns text language sql immutable set search_path = public
as $$ select 'deepseek-v4-flash-vision-exp'::text $$;
revoke all on function private.model_ekstraksi() from public, anon, authenticated;

-- 4. Penjaga penanda. Ditulis di atas versi 20260922c; penjagaan diverifikasi_otomatis
--    dipertahankan apa adanya, ditambah satu penjagaan dengan pola yang sama persis.
create or replace function private.jaga_penanda_otomatis()
returns trigger language plpgsql set search_path = public
as $$
begin
  -- Tanpa penanda transaksi, kolom ini tidak boleh berubah dari keadaan sebelumnya. Pada
  -- INSERT, OLD null diperlakukan sebagai false, sehingga `true` tetap ditolak.
  if NEW.diverifikasi_otomatis is distinct from coalesce(OLD.diverifikasi_otomatis, false)
     and coalesce(current_setting('app.penutup_iom', true), '') <> '1' then
    raise exception 'Penanda verifikasi otomatis hanya boleh diisi basis data.'
      using errcode = 'check_violation';
  end if;

  -- Penanda "dibaca AI" (catatan/17). Penanda yang bisa dihapus pemiliknya bukan jejak: tanpa
  -- ini Sales bisa mengosongkannya lewat PostgREST dan PO hasil ekstraksi jadi tampak seperti
  -- PO yang diketik sendiri.
  if NEW.dibaca_ai_pada is distinct from OLD.dibaca_ai_pada
     and coalesce(current_setting('app.penanda_ekstraksi', true), '') <> '1' then
    raise exception 'Penanda isian AI hanya boleh diisi basis data.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

revoke all on function private.jaga_penanda_otomatis() from public, anon, authenticated;

-- 5. Pembekuan: kolom baru masuk KEDUA tuple, atau nilainya bisa diubah lewat PostgREST pada PO
--    yang sudah diteken.
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
      NEW.skema_ttd, NEW.nama_rh, NEW.dibaca_ai_pada)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh, OLD.dibaca_ai_pada)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;

-- 6. Sidik tinjauan: kolom baru dikeluarkan selama KOSONG. Sidik adalah hash to_jsonb(baris),
--    jadi kunci baru yang muncul kosong di setiap baris akan membasikan setiap draf unggahan
--    yang sudah dinyatakan sesuai, dan Sales meninjau ulang tanpa ada yang berubah (pola yang
--    sama dengan nama_rh di 20260925b). Bila terisi, ia ikut disidik: ia selalu terisi sebelum
--    Sales meninjau, jadi tidak pernah membasikan tinjauan. Ditulis di atas versi 20260925b.
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
          - case when p.nama_rh is null then 'nama_rh' else '' end
          - case when p.dibaca_ai_pada is null then 'dibaca_ai_pada' else '' end,
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
```

- [ ] **Langkah 4: Salin byte-identik ke rantai**

```bash
cp supabase/migrasi/20260926a_gerbang_ekstraksi.sql \
   supabase/migrations/20260926010000_gerbang_ekstraksi.sql
```

- [ ] **Langkah 5: Tulis bukti basis datanya**

`uji/db-lokal/bukti-gerbang-ekstraksi.sql` (pola `bukti-empat-ttd.sql`; setiap probe di dalam
transaksi yang dibatalkan):

```sql
\set ON_ERROR_STOP on
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('super@uji', 'Super Uji', '{admin_utama}', true)
on conflict (email) do nothing;
insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh, kepala_sekolah, kepsek_hp, bendahara, bendahara_hp)
  values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji', 'KS', '1', 'B', '1')
on conflict do nothing;

-- P1: gerbang MATI secara bawaan, dan menyalakannya tanpa penerima risiko ditolak basis data.
begin;
  select pg_temp.sebagai('super@uji');
  do $$ begin
    begin
      insert into pengaturan_ekstraksi (menyala, penyedia, model, diubah_oleh)
        values (true, 'OpenCode', 'x', 'super@uji');
      raise exception 'P1 GAGAL: gerbang menyala tanpa penerima risiko';
    exception when check_violation then null; end;
  end $$;
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  do $$ begin raise notice 'P1 OK: menyalakan tanpa penerima risiko ditolak'; end $$;
rollback;

-- P2: Sales tidak bisa membaca maupun menulis riwayat gerbang.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  select pg_temp.sebagai('sales@uji');
  do $$
  declare v int;
  begin
    select count(*) into v from pengaturan_ekstraksi;
    if v <> 0 then raise exception 'P2 GAGAL: Sales membaca % baris gerbang', v; end if;
    begin
      insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (true, 'sales@uji');
      raise exception 'P2 GAGAL: Sales menulis riwayat gerbang';
    exception when insufficient_privilege then null; end;
    raise notice 'P2 OK: gerbang tertutup bagi Sales, baca maupun tulis';
  end $$;
rollback;

-- P3: dibaca_ai_pada hanya boleh diisi basis data; Sales ditolak mengisi DAN mengosongkan.
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    begin
      update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e1';
      raise exception 'P3 GAGAL: Sales mengisi dibaca_ai_pada';
    exception when check_violation then null; end;
  end $$;
  -- Lewat jalur yang diizinkan basis data (setelan transaksi), lalu dicoba dikosongkan lagi.
  set local app.penanda_ekstraksi = '1';
  update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e1';
  set local app.penanda_ekstraksi = '';
  do $$ begin
    begin
      update po set dibaca_ai_pada = null where id = '00000000-0000-0000-0000-0000000000e1';
      raise exception 'P3 GAGAL: Sales mengosongkan dibaca_ai_pada';
    exception when check_violation then null; end;
    raise notice 'P3 OK: penanda isian AI tidak bisa dipalsukan maupun dihapus Sales';
  end $$;
rollback;

-- P4: PO yang sudah keluar draf tidak bisa ditulisi penanda lagi (pembekuan ikut).
begin;
  set local session_replication_role = replica;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000);
  set local session_replication_role = origin;
  update po set status = 'ditandatangani' where id = '00000000-0000-0000-0000-0000000000e2';
  set local app.penanda_ekstraksi = '1';
  set local session_replication_role = replica;
  set local session_replication_role = origin;
  do $$ begin
    begin
      update po set dibaca_ai_pada = now() where id = '00000000-0000-0000-0000-0000000000e2';
      raise exception 'P4 GAGAL: penanda berubah pada PO yang sudah diteken';
    exception when check_violation then null; end;
    raise notice 'P4 OK: penanda beku pada PO yang sudah keluar draf';
  end $$;
rollback;

-- P9 TIDAK ada di berkas ini. Ia sudah punya rumah: uji/db-lokal/bukti-sidik.sql, yang mencatat
-- sidik sekumpulan PO sebelum migrasi dan membandingkannya sesudah (`-v mode=catat` lalu
-- `-v mode=banding`, dijalankan uji/db-lokal/jalankan-bukti.sh). JANGAN menulis cara kedua.

-- Yang wajib dilakukan di Tugas 1 untuk P9: PERPANJANG uji/db-lokal/bukti-sidik.sql dengan satu
-- PO fikstur baru yang:
--   * berstatus draf, asal 'unggahan', berkas_unggahan menunjuk objek po-unggahan/{id}/po.pdf;
--   * sudah punya ditinjau_pada terisi dan ditinjau_sidik terisi (dinyatakan sesuai pindaian);
--   * dibaca_ai_pada masih KOSONG (persis keadaan draf unggahan yang lahir sebelum fitur ini).
-- Kalau sidik PO itu berubah antara catat dan banding, kolom dibaca_ai_pada belum dikeluarkan
-- dengan benar di Langkah 3, dan setiap draf unggahan yang sudah ditinjau akan menuntut tinjau
-- ulang tanpa ada yang berubah pada pindaiannya.
```

> **Kenapa P9 penting.** Ini satu-satunya probe yang menjaga PO yang SUDAH ada. Fitur barunya
> tidak menyentuh draf lama, tetapi kolom baru pada tabel `po` menyentuh sidik SETIAP baris, dan
> sidik adalah gerbang "data ini sesuai dengan pindaian". Draf yang ditinjau sebelum migrasi harus
> tetap bisa diajukan sesudahnya.

- [ ] **Langkah 6: Tulis runner buktinya**

`uji/db-lokal/jalankan-bukti-ekstraksi.sh`:

```bash
#!/usr/bin/env bash
# Bukti gerbang ekstraksi (catatan/25 Tugas 1) dan RPC-nya (Tugas 2): basis data baru berisi
# skema produksi, P9 dicatat sebelum migrasi, ketiga migrasi 20260926* diterapkan, lalu
# P9 dibandingkan dan seluruh probe dijalankan.
set -euo pipefail
cd "$(dirname "$0")/../.."
uji/db-lokal/siapkan.sh >/dev/null
D="docker exec -i kerjasama-uji psql -U postgres -v ON_ERROR_STOP=1"
$D -q -v mode=catat < uji/db-lokal/bukti-sidik.sql >/dev/null
$D -q -1 < supabase/migrations/20260926010000_gerbang_ekstraksi.sql
$D -q -1 < supabase/migrations/20260926020000_ekstraksi_po.sql
$D -q -1 < supabase/migrations/20260926030000_konfirmasi_langkah.sql
$D -v mode=banding < uji/db-lokal/bukti-sidik.sql 2>&1 | grep -E "NOTICE|ERROR"
$D < uji/db-lokal/bukti-gerbang-ekstraksi.sql 2>&1 | grep -E "NOTICE|ERROR"
$D < uji/db-lokal/bukti-rpc-ekstraksi.sql 2>&1 | grep -E "NOTICE|ERROR"
```

Langkah 6 baru bisa dijalankan penuh sesudah Tugas 2 dan Tugas 7 punya berkasnya. Sebelum itu,
jalankan dua perintah pertama untuk membuktikan Tugas 1 saja.

- [ ] **Langkah 7: Jalankan bukti dan uji penjaga**

Jalankan: `uji/db-lokal/jalankan-bukti-ekstraksi.sh`
Harapan: tiap probe mencetak `P… OK`, tidak ada `ERROR`, dan P9 tidak melaporkan selisih.

Jalankan: `node --test uji/ekstraksi-migrasi.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 8: Commit**

```bash
git add supabase/migrasi/20260926a_gerbang_ekstraksi.sql \
        supabase/migrations/20260926010000_gerbang_ekstraksi.sql \
        uji/ekstraksi-migrasi.test.mjs uji/db-lokal/jalankan-bukti-ekstraksi.sh \
        uji/db-lokal/bukti-gerbang-ekstraksi.sql uji/db-lokal/bukti-sidik.sql
git commit -m "Ekstraksi: gerbang organisasi dan penanda dibaca_ai_pada (catatan/25 Tugas 1)"
```

---

### Tugas 2: Tabel `ekstraksi_po` dan tiga RPC, dengan buktinya

**Berkas:**
- Buat: `supabase/migrasi/20260926b_ekstraksi_po.sql`
- Buat: `supabase/migrations/20260926020000_ekstraksi_po.sql` (salinan byte-identik)
- Buat: `uji/db-lokal/bukti-rpc-ekstraksi.sql`
- Uji: `uji/ekstraksi-rpc.test.mjs`

**Antarmuka:**
- Mengonsumsi: `pengaturan_ekstraksi`, `po.dibaca_ai_pada`, setelan `app.penanda_ekstraksi` (Tugas 1).
- Menghasilkan (dipakai Tugas 5):
  - `public.klaim_ekstraksi() returns uuid`
  - `public.selesai_ekstraksi(p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text,
    p_durasi_ms int, p_token_masuk int, p_token_keluar int) returns void`
  - `public.tautkan_ekstraksi(p_id uuid, p_po uuid) returns void`

- [ ] **Langkah 1: Tulis uji penjaga yang gagal**

`uji/ekstraksi-rpc.test.mjs`:

```js
// Penjaga statis RPC ekstraksi: EXECUTE dicabut dari PUBLIC, dan tabelnya tidak punya jalan
// tulis klien. Bukti perilakunya di uji/db-lokal/bukti-rpc-ekstraksi.sql.
import assert from 'node:assert/strict';
import { migrasiTerakhir } from './migrasi.mjs';

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const rpc = migrasiTerakhir(/function public\.klaim_ekstraksi/).isi;
for (const f of ['klaim_ekstraksi()', 'selesai_ekstraksi(', 'tautkan_ekstraksi(']) {
  const pola = new RegExp(`revoke all on function public\\.${f.replace('(', '\\(')}`);
  assert.match(rpc, pola, `EXECUTE ${f} tidak dicabut dari PUBLIC`);
}
ok('ketiga RPC dicabut dari PUBLIC dan anon');

assert.match(rpc, /app\.penanda_ekstraksi/);
assert.match(rpc, /set_config\('app\.penanda_ekstraksi', ''/);
ok('tautkan_ekstraksi memasang lalu melepas penanda transaksi');

assert.match(migrasiTerakhir(/create table if not exists ekstraksi_po/).isi,
  /po_id uuid unique references po\(id\)/);
ok('satu PO paling banyak satu pembacaan, ditegakkan unique di basis data');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/ekstraksi-rpc.test.mjs`
Harapan: GAGAL (`tidak ada migrasi yang cocok`).

- [ ] **Langkah 3: Tulis migrasinya**

`supabase/migrasi/20260926b_ekstraksi_po.sql`:

```sql
-- Satu baris per pembacaan scan oleh AI (catatan/17 + amandemen 3: "baca dulu, simpan sesudahnya").
--
-- po_id BOLEH KOSONG sampai ditautkan: scan dibaca sebelum draf ada, dan percobaan yang
-- ditinggalkan tidak boleh meninggalkan PO setengah jadi. Unik bila terisi, dan itulah penegak
-- "satu pembacaan per PO" yang disebut spesifikasi.
create table if not exists ekstraksi_po (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid unique references po(id) on delete cascade,
  diklaim_oleh   text not null,
  diklaim_pada   timestamptz not null default now(),
  dicentang_oleh text not null,
  dicentang_pada timestamptz not null default now(),
  model          text not null,
  selesai_pada   timestamptz,
  durasi_ms      integer,
  token_masuk    integer,
  token_keluar   integer,
  berhasil       boolean,
  galat          text,
  hasil          jsonb
);

comment on table ekstraksi_po is
  'Pembacaan scan PO oleh model vision (catatan/17). Hanya Super Admin yang membaca; isinya '
  'adalah data yang sudah ada di pindaian, jadi paparannya tidak bertambah. po_id kosong = '
  'pembacaan yang belum tertaut ke PO mana pun. Masa simpannya MENGIKUTI pindaian PO: '
  'po-unggahan ada di TIDAK_DIHAPUS (lib/retensi.ts), jadi dalam praktik baris ini tidak pernah '
  'dihapus. ON DELETE CASCADE mengikatnya ke PO, supaya kalau kebijakan pindaian suatu hari '
  'berubah dan PO-nya dibuang, catatan pembacaannya ikut terbawa pada tindakan yang sama.';

create index if not exists ekstraksi_po_klaim_idx on ekstraksi_po (diklaim_pada desc);

alter table ekstraksi_po enable row level security;

-- Satu-satunya policy: baca oleh Super Admin. Tidak ada jalan tulis klien sama sekali; seluruh
-- penulisan lewat ketiga fungsi security definer di bawah.
drop policy if exists ekstraksi_baca on ekstraksi_po;
create policy ekstraksi_baca on ekstraksi_po for select to authenticated
  using ('admin_utama' = any (private.peran_saya()));

-- ---------------------------------------------------------------------------
-- 1. klaim_ekstraksi(): memesan pembacaan SEBELUM penyedia dipanggil
-- ---------------------------------------------------------------------------
-- Tab kedua atau klik ganda tidak boleh mengirim scan dua kali, dan hallo itu yang menahan
-- biaya: tanpa klaim, penekanan tombol berulang = panggilan berulang.
create or replace function public.klaim_ekstraksi()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saya   text := lower(auth.jwt() ->> 'email');
  v_nyala  boolean;
  v_jumlah int;
  v_id     uuid;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  -- Gerbang organisasi. Baris terakhir yang berlaku; tanpa baris = mati.
  select menyala into v_nyala from pengaturan_ekstraksi order by id desc limit 1;
  if coalesce(v_nyala, false) is not true then
    raise exception 'Pembacaan scan dengan AI belum dinyalakan.' using errcode = 'check_violation';
  end if;

  -- Pemanggil harus berperan pembuat PO. Saat klaim belum ada PO-nya, jadi yang diperiksa
  -- perannya, bukan kepemilikan sebuah PO.
  if not private.punya_peran('sales', 'head_of_sales', 'admin_sales') then
    raise exception 'Hanya Sales yang boleh membaca scan.' using errcode = 'check_violation';
  end if;

  select count(*) into v_jumlah from ekstraksi_po
   where diklaim_oleh = v_saya
     and (diklaim_pada at time zone 'Asia/Jakarta')::date = (now() at time zone 'Asia/Jakarta')::date;
  if v_jumlah >= 20 then
    raise exception 'Batas 20 pembacaan scan per hari sudah tercapai.' using errcode = 'check_violation';
  end if;

  -- Hasil mentah klaim yang tidak pernah ditautkan dibuang sesudah 24 jam: data pribadi dari
  -- scan tidak boleh tinggal di basis data tanpa PO yang memilikinya.
  update ekstraksi_po set hasil = null
   where po_id is null and hasil is not null and selesai_pada < now() - interval '24 hours';

  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model)
    values (v_saya, v_saya, private.model_ekstraksi())
    returning id into v_id;
  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- 2. selesai_ekstraksi(): hasil ditulis SEKALI, oleh pengklaimnya
-- ---------------------------------------------------------------------------
create or replace function public.selesai_ekstraksi(
  p_id uuid, p_berhasil boolean, p_hasil jsonb, p_galat text,
  p_durasi_ms integer, p_token_masuk integer, p_token_keluar integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_row  ekstraksi_po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_row from ekstraksi_po where id = p_id;
  if not found then
    raise exception 'Pembacaan tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_oleh is distinct from v_saya then
    raise exception 'Pembacaan ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_row.selesai_pada is not null then
    raise exception 'Pembacaan ini sudah selesai.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_pada < now() - interval '5 minutes' then
    raise exception 'Klaim ini sudah kedaluwarsa.' using errcode = 'check_violation';
  end if;

  update ekstraksi_po
     set selesai_pada = now(), berhasil = p_berhasil, hasil = p_hasil, galat = p_galat,
         durasi_ms = p_durasi_ms, token_masuk = p_token_masuk, token_keluar = p_token_keluar
   where id = p_id;
end $$;

-- ---------------------------------------------------------------------------
-- 3. tautkan_ekstraksi(): menautkan hasil ke PO yang baru lahir, dan menandainya
-- ---------------------------------------------------------------------------
create or replace function public.tautkan_ekstraksi(p_id uuid, p_po uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_row  ekstraksi_po%rowtype;
  v_po   po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;

  select * into v_row from ekstraksi_po where id = p_id;
  if not found then
    raise exception 'Pembacaan tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_row.diklaim_oleh is distinct from v_saya then
    raise exception 'Pembacaan ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_row.berhasil is not true then
    raise exception 'Pembacaan ini tidak berhasil.' using errcode = 'check_violation';
  end if;
  if v_row.po_id is not null then
    raise exception 'Pembacaan ini sudah tertaut ke PO lain.' using errcode = 'check_violation';
  end if;
  if v_row.hasil is null then
    raise exception 'Hasil pembacaan sudah dibuang.' using errcode = 'check_violation';
  end if;

  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_po.dibuat_oleh) is distinct from v_saya then
    raise exception 'PO ini bukan milikmu.' using errcode = 'check_violation';
  end if;
  if v_po.asal <> 'unggahan' then
    raise exception 'Jalur ini hanya untuk PO unggahan.' using errcode = 'check_violation';
  end if;
  if v_po.status not in ('draf', 'ditolak') then
    raise exception 'PO ini sudah keluar dari draf.' using errcode = 'check_violation';
  end if;
  if v_po.dibaca_ai_pada is not null
     or exists (select 1 from ekstraksi_po e where e.po_id = p_po) then
    raise exception 'PO ini sudah punya pembacaan.' using errcode = 'check_violation';
  end if;

  update ekstraksi_po set po_id = p_po where id = p_id;

  -- Penanda hanya boleh diisi basis data; setelannya dilepas lagi di akhir, karena `set_config`
  -- transaksi-lokal TETAP berlaku sesudah blok selesai (pelajaran 17 Sep 2026).
  perform set_config('app.penanda_ekstraksi', '1', true);
  update po set dibaca_ai_pada = v_row.selesai_pada where id = p_po;
  perform set_config('app.penanda_ekstraksi', '', true);
end $$;

revoke all on function public.klaim_ekstraksi() from public, anon;
revoke all on function public.selesai_ekstraksi(uuid, boolean, jsonb, text, integer, integer, integer) from public, anon;
revoke all on function public.tautkan_ekstraksi(uuid, uuid) from public, anon;
grant execute on function public.klaim_ekstraksi() to authenticated;
grant execute on function public.selesai_ekstraksi(uuid, boolean, jsonb, text, integer, integer, integer) to authenticated;
grant execute on function public.tautkan_ekstraksi(uuid, uuid) to authenticated;
```

> **Kenapa nama model dipaku di basis data.** `klaim_ekstraksi()` memanggil
> `private.model_ekstraksi()` (bagian 3 di atas), bukan menerima nama model dari klien: catatan
> pembacaan harus menyebut model yang benar-benar dipakai, dan `lib/penyedia-ekstraksi.ts` (Tugas
> 4) memakai konstanta yang sama. Kalau modelnya berganti, dua tempat ini berpindah bersama.

- [ ] **Langkah 4: Salin byte-identik ke rantai**

```bash
cp supabase/migrasi/20260926b_ekstraksi_po.sql \
   supabase/migrations/20260926020000_ekstraksi_po.sql
```

- [ ] **Langkah 5: Tulis buktinya**

`uji/db-lokal/bukti-rpc-ekstraksi.sql` — setiap probe di dalam transaksi yang dibatalkan, pola
`bukti-empat-ttd.sql`:

```sql
\set ON_ERROR_STOP on
create or replace function pg_temp.sebagai(p_email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('email', p_email, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create or replace function pg_temp.tolak(p_isi text) returns void language plpgsql as $$
begin
  begin execute p_isi; raise exception 'GAGAL: % seharusnya ditolak', p_isi;
  exception when check_violation or insufficient_privilege then null; end;
end $$;

insert into pengguna (email, nama, peran, aktif) values
  ('sales@uji', 'Sales Uji', '{sales}', true),
  ('sales2@uji', 'Sales Dua', '{sales}', true),
  ('super@uji', 'Super Uji', '{admin_utama}', true)
on conflict (email) do nothing;

-- P1: gerbang mati => klaim ditolak.
begin;
  select pg_temp.sebagai('sales@uji');
  do $$ begin
    begin perform public.klaim_ekstraksi(); raise exception 'P1 GAGAL: klaim lolos saat gerbang mati';
    exception when check_violation then null; end;
    raise notice 'P1 OK: gerbang mati menolak klaim';
  end $$;
rollback;

-- P2: gerbang menyala; bukan Sales ditolak; klaim ganda dalam sehari dihitung.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'deepseek-v4-flash-vision-exp', 'pelatihan dimatikan',
            'Rizki', 'tanpa DPA, diterima', 'super@uji');
  do $$
  declare v uuid; v2 uuid;
  begin
    select pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    v2 := public.klaim_ekstraksi();
    if v = v2 then raise exception 'P2 GAGAL: klaim kedua tidak melahirkan baris baru'; end if;
    raise notice 'P2 OK: dua klaim berbeda dalam satu hari';
  end $$;
  do $$
  declare v uuid;
  begin
    select pg_temp.sebagai('super@uji');
    -- Super Admin lolos punya_peran, jadi batas harian diuji dengan menyisipkan 20 klaim palsu.
    insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model)
      select 'sales@uji', 'sales@uji', 'x' from generate_series(1, 20);
    select pg_temp.sebagai('sales@uji');
    begin v := public.klaim_ekstraksi(); raise exception 'P2 GAGAL: klaim ke-21 lolos';
    exception when check_violation then null; end;
    raise notice 'P2 OK: batas 20 klaim per hari menahan klaim ke-21';
  end $$;
rollback;

-- P3: hasil ditulis sekali, hanya oleh pengklaim, hanya dalam 5 menit.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'deepseek-v4-flash-vision-exp', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    select pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    select pg_temp.sebagai('sales2@uji');
    begin perform public.selesai_ekstraksi(v, true, '{}'::jsonb, null, 10, 1, 1);
      raise exception 'P3 GAGAL: orang lain menutup klaim';
    exception when check_violation then null; end;
    select pg_temp.sebagai('sales@uji');
    perform public.selesai_ekstraksi(v, true, '{"sekolah":{}}'::jsonb, null, 10, 1, 1);
    begin perform public.selesai_ekstraksi(v, true, '{"sekolah":{}}'::jsonb, null, 10, 1, 1);
      raise exception 'P3 GAGAL: hasil ditulis dua kali';
    exception when check_violation then null; end;
    -- Kedaluwarsa 5 menit: dimajukan dengan mengubah waktu klaim.
    update ekstraksi_po set diklaim_pada = now() - interval '6 minutes', selesai_pada = null where id = v;
    begin perform public.selesai_ekstraksi(v, true, '{}'::jsonb, null, 10, 1, 1);
      raise exception 'P3 GAGAL: klaim kedaluwarsa masih bisa ditutup';
    exception when check_violation then null; end;
    raise notice 'P3 OK: sekali, oleh pengklaim, dalam lima menit';
  end $$;
rollback;

-- P4: hasil mentah klaim tak tertaut dikosongkan sesudah 24 jam.
begin;
  select pg_temp.sebagai('super@uji');
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model, selesai_pada, berhasil, hasil)
    values ('sales@uji', 'sales@uji', 'x', now() - interval '25 hours', true, '{"rahasia":1}'::jsonb);
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  select pg_temp.sebagai('sales@uji');
  perform public.klaim_ekstraksi();
  do $$ begin
    if exists (select 1 from ekstraksi_po where hasil = '{"rahasia":1}'::jsonb) then
      raise exception 'P4 GAGAL: hasil mentah klaim lama masih tersimpan';
    end if;
    raise notice 'P4 OK: hasil mentah tanpa PO dibuang sesudah 24 jam';
  end $$;
rollback;

-- P5: tautkan hanya ke PO sendiri, unggahan, draf, dan sekali saja; penandanya terpasang.
begin;
  set local session_replication_role = replica;
  insert into sekolah (id, nama, jenjang, npsn, dipegang_oleh)
    values ('00000000-0000-0000-0000-00000000a001', 'SMA UJI', 'SMA', '99990001', 'sales@uji')
    on conflict do nothing;
  insert into po (id, sekolah_id, dibuat_oleh, status, asal, grand_total, jumlah_siswa, harga_siswa)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'unggahan', 1000, 1, 1000),
           ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-00000000a001',
            'sales2@uji', 'draf', 'unggahan', 1000, 1, 1000),
           ('00000000-0000-0000-0000-0000000000f3', '00000000-0000-0000-0000-00000000a001',
            'sales@uji', 'draf', 'platform', 1000, 1, 1000);
  set local session_replication_role = origin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, penyedia, paket_akun, model, pemeriksaan_data,
                                    risiko_diterima_oleh, alasan_risiko, diubah_oleh)
    values (true, 'OpenCode Go', 'Go', 'x', 'x', 'Rizki', 'x', 'super@uji');
  do $$
  declare v uuid;
  begin
    select pg_temp.sebagai('sales@uji');
    v := public.klaim_ekstraksi();
    perform public.selesai_ekstraksi(v, true, '{"sekolah":{"nama":"SMA UJI"}}'::jsonb, null, 10, 1, 1);
    begin perform public.tautkan_ekstraksi(v, '00000000-0000-0000-0000-0000000000f2');
      raise exception 'P5 GAGAL: menautkan ke PO orang lain';
    exception when check_violation then null; end;
    begin perform public.tautkan_ekstraksi(v, '00000000-0000-0000-0000-0000000000f3');
      raise exception 'P5 GAGAL: menautkan ke PO platform';
    exception when check_violation then null; end;
    perform public.tautkan_ekstraksi(v, '00000000-0000-0000-0000-0000000000f1');
    if (select dibaca_ai_pada from po where id = '00000000-0000-0000-0000-0000000000f1') is null then
      raise exception 'P5 GAGAL: penanda tidak terpasang';
    end if;
    begin perform public.tautkan_ekstraksi(v, '00000000-0000-0000-0000-0000000000f1');
      raise exception 'P5 GAGAL: menautkan dua kali';
    exception when check_violation then null; end;
    raise notice 'P5 OK: tautan hanya ke PO sendiri, unggahan, draf, sekali';
  end $$;
rollback;

-- P6: Sales tidak bisa membaca tabel pembacaan maupun tabel gerbang.
begin;
  select pg_temp.sebagai('super@uji');
  insert into pengaturan_ekstraksi (menyala, diubah_oleh) values (false, 'super@uji');
  insert into ekstraksi_po (diklaim_oleh, dicentang_oleh, model) values ('sales@uji', 'sales@uji', 'x');
  select pg_temp.sebagai('sales@uji');
  do $$
  declare a int; b int;
  begin
    select count(*) into a from ekstraksi_po;
    select count(*) into b from pengaturan_ekstraksi;
    if a <> 0 or b <> 0 then raise exception 'P6 GAGAL: Sales membaca % baris pembacaan, % baris gerbang', a, b; end if;
    raise notice 'P6 OK: kedua tabel tertutup bagi Sales';
  end $$;
rollback;
```

- [ ] **Langkah 6: Jalankan bukti dan uji penjaga**

Jalankan: `uji/db-lokal/jalankan-bukti-ekstraksi.sh`
Harapan: `P1` sampai `P6` mencetak `OK`; tidak ada `ERROR`.

Jalankan: `node --test uji/ekstraksi-rpc.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 7: Commit**

```bash
git add supabase/migrasi/20260926b_ekstraksi_po.sql \
        supabase/migrations/20260926020000_ekstraksi_po.sql \
        uji/ekstraksi-rpc.test.mjs uji/db-lokal/bukti-rpc-ekstraksi.sql \
        uji/db-lokal/jalankan-bukti-ekstraksi.sh
git commit -m "Ekstraksi: tabel ekstraksi_po dan tiga RPC dengan buktinya (catatan/25 Tugas 2)"
```

---

### Tugas 3: `lib/ekstraksi-po.ts` — pemetaan hasil baca ke isian wizard

**Berkas:**
- Buat: `lib/ekstraksi-po.ts`
- Uji: `uji/ekstraksi-po.test.mjs`
- Buat: `uji/emas/ekstraksi-dummy.json` (fikstur rekaan, bukan PO asli)

**Antarmuka:**
- Mengonsumsi: `KELAS` dari `lib/kelas.ts` (tidak berubah).
- Menghasilkan (dipakai Tugas 6, 8):
  - `type IsianScan` — bentuk JSON yang diminta dari model.
  - `type HasilPetakan` — isian wizard yang siap dipakai.
  - `petakanEkstraksi(m: unknown, p: { idsPaket: (nama: string) => string[] | null }): HasilPetakan`
  - `wajibDicentang(hasil: HasilPetakan): string[]`
  - `langkahIsian(hasil: HasilPetakan): { langkah: KodeLangkah; kunci: string[] }[]`
  - `KOTAK_PAKET: readonly string[]`, `HP_KEYS: readonly string[]`

- [ ] **Langkah 1: Tulis fikstur rekaan**

`uji/emas/ekstraksi-dummy.json` — sekolah fiktif, nomor palsu, sengaja memuat satu nomor HP yang
ditandai ragu dan satu isian yang tidak terbaca:

```json
{
  "sekolah": {
    "nama": "SMA DUMMY NUSANTARA", "npsn": "12345678", "jenjang": "SMA",
    "alamat": "Jl. Contoh No. 1", "telepon": "021000000",
    "kepala_sekolah": "Budi Dummy", "kepsek_hp": "081200000001",
    "bendahara": "Sari Dummy", "bendahara_hp": "081200000002"
  },
  "kotak_paket": ["LMS Juara"],
  "kotak_lain": [],
  "custom_teks": null,
  "harga_siswa": 350000,
  "harga_guru": 0,
  "rombel": [
    { "kelas": "X", "rombel": "A", "jumlah": 32 },
    { "kelas": "XI", "rombel": "A", "jumlah": 30 },
    { "kelas": "XII", "rombel": "B", "jumlah": 28 }
  ],
  "termin": [
    { "tanggal": "2026-01-15", "nominal": 5000000 },
    { "tanggal": "2026-04-15", "nominal": 5000000 }
  ],
  "masa_mulai": "2026-01-01",
  "masa_selesai": "2026-12-31",
  "sumber_dana": "BOS",
  "kota": "Surabaya",
  "tanggal_ttd": "2026-01-10",
  "catatan": ["Pelaksanaan dimulai Januari"],
  "ragu": ["sekolah.bendahara_hp"],
  "tidak_terbaca": ["sekolah.email"],
  "peringatan": ["Tabel termin tidak rapi: kolom tanggal dan nominal tidak sejajar"]
}
```

- [ ] **Langkah 2: Tulis uji yang gagal**

`uji/ekstraksi-po.test.mjs`:

```js
// Pemetaan hasil baca AI ke isian wizard (catatan/17 + amandemen 2). Murni: tanpa pricelist,
// tanpa jaringan. Himpunan ids paket disuntikkan, seperti di aplikasi.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { muat } from './muat.mjs';

const E = muat('ekstraksi-po');

const idsPaket = (nama) => ({ 'LMS Juara': ['lms', 'modul', 'video'], 'LMS Lite': ['lms'] }[nama] ?? null);
const dummy = JSON.parse(readFileSync(new URL('./emas/ekstraksi-dummy.json', import.meta.url), 'utf8'));

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 1. Kotak paket jelas -> himpunan ids paket itu PERSIS, tidak ditambah harga berkelompok.
const h = E.petakanEkstraksi(dummy, { idsPaket });
assert.deepEqual(h.komponen, [{ id: 'lms', sesi: 0 }, { id: 'modul', sesi: 0 }, { id: 'video', sesi: 0 }]);
ok('satu kotak paket jelas mengisi komponen persis himpunan paketnya');

// 2. Dua kotak jelas atau kotak tak dikenal: tanpa komponen, tampil sebagai catatan.
const dua = E.petakanEkstraksi({ ...dummy, kotak_paket: ['LMS Juara', 'LMS Lite'] }, { idsPaket });
assert.equal(dua.komponen, null);
assert.match(dua.catatanPaket, /LMS Juara/);
const asing = E.petakanEkstraksi({ ...dummy, kotak_paket: ['Paket Karangan'] }, { idsPaket });
assert.equal(asing.komponen, null);
assert.match(asing.catatanPaket, /Paket Karangan/);
ok('dua kotak atau kotak asing: komponen kosong, alasannya tampil sebagai catatan');

// 3. Kotak lain tampil sebagai catatan, Custom disertakan apa adanya.
const lain = E.petakanEkstraksi({ ...dummy, kotak_paket: [], kotak_lain: ['UTBK'], custom_teks: 'PM OFFLINE' }, { idsPaket });
assert.equal(lain.komponen, null);
assert.match(lain.catatanPaket, /UTBK/);
assert.match(lain.catatanPaket, /PM OFFLINE/);
ok('kotak lain dan teks Custom tampil sebagai catatan langkah 2');

// 4. Rombel: X/XI/XII diurai ke angka kelas SMA; baris di luar jenjang dibuang.
assert.deepEqual(h.rombel, [
  { kelas: 10, rombel: 'A', jumlah: 32 },
  { kelas: 11, rombel: 'A', jumlah: 30 },
  { kelas: 12, rombel: 'B', jumlah: 28 },
]);
const luar = E.petakanEkstraksi({ ...dummy, rombel: [{ kelas: 'VII', rombel: 'A', jumlah: 30 }] }, { idsPaket });
assert.deepEqual(luar.rombel, []);
ok('rombel di luar jenjang dibuang, bukan ditebak');

// 5. Nilai tidak sah dibuang dengan keterangan "tidak terbaca", bukan ditebak.
const rusak = E.petakanEkstraksi({
  ...dummy, tanggal_ttd: '31 Februari', harga_siswa: 'tiga ratus',
  sekolah: { ...dummy.sekolah, jenjang: 'SMK' },
}, { idsPaket });
assert.equal(rusak.lain.tanggalTtd, null);
assert.equal(rusak.harga.siswa, null);
// Jenjang di luar SD/SMP/SMA dibuang, TIDAK ditebak jadi SMA: wizard tetap memakai bawaannya.
assert.equal(rusak.sekolah.jenjang, undefined);
assert.ok(rusak.tidakTerbaca.includes('sekolah.jenjang'));
ok('tanggal ngawur, nominal bukan angka, jenjang di luar SD/SMP/SMA dibuang');

// 6. Jenis catatan SELALU kosong: AI mengisi isinya, Sales yang memilih jenisnya.
assert.deepEqual(h.catatan, [{ isi: 'Pelaksanaan dimulai Januari', jenis: null }]);
ok('jenis catatan selalu kosong dari hasil baca');

// 7. Nomor HP selalu wajib dicentang, ditandai ragu atau tidak; isian ragu ikut dituntut.
const tuntut = E.wajibDicentang(h);
for (const k of E.HP_KEYS) assert.ok(tuntut.includes(k), `${k} harus dituntut`);
assert.ok(tuntut.includes('sekolah.email'), 'isian tidak terbaca harus dituntut');
ok('nomor HP dan isian ragu/tidak terbaca selalu dituntut centangnya');

// 8. Tanda ragu dan peringatan diteruskan apa adanya.
assert.deepEqual(h.ragu, ['sekolah.bendahara_hp']);
assert.equal(h.peringatan.length, 1);
ok('tanda ragu dan peringatan AI diteruskan ke layar');

// 9. Nilai sponsorship TIDAK PERNAH diisi dari scan.
assert.equal(h.lain.nilaiSponsorship, undefined);
ok('nilai sponsorship tidak pernah datang dari hasil baca');

// 10. Langkah isian: lima langkah yang memuat isian dari scan, urut wizard.
assert.deepEqual(E.langkahIsian(h).map((x) => x.langkah),
  ['sekolah', 'paket', 'rombel', 'termin', 'penanda']);
ok('lima langkah memuat isian dari scan, urut seperti wizard');

// 11. Hasil baca yang sama sekali tidak sesuai skema tidak melempar.
const kosong = E.petakanEkstraksi('bukan objek', { idsPaket });
assert.deepEqual(kosong.dariScan, []);
ok('hasil tidak sesuai skema menghasilkan pemetaan kosong, bukan galat');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 3: Jalankan, pastikan gagal**

Jalankan: `node --test uji/ekstraksi-po.test.mjs`
Harapan: GAGAL (`Cannot find module ... lib/ekstraksi-po.ts`).

- [ ] **Langkah 4: Implementasi `lib/ekstraksi-po.ts`**

```ts
/**
 * Pemetaan hasil baca AI ke isian wizard (catatan/17, amandemen 2 dan 3).
 *
 * SENGAJA tidak mengimpor lib/pricelist.ts: modul ini jalan di peramban, dan pricelist memuat
 * harga Acquisition. Himpunan ids sebuah paket disuntikkan pemanggil lewat `idsPaket`, jadi
 * modul ini tetap murni dan teruji tanpa membawa satu pun angka harga.
 *
 * Kaidah yang dijaga di sini (catatan/17 "Aturan pengisian"):
 *   - nilai tidak sah DIBUANG, tidak ditebak;
 *   - jenis catatan selalu kosong, Sales yang memilih;
 *   - nilai sponsorship tidak pernah diisi dari scan;
 *   - nomor HP selalu wajib dicentang, ditandai ragu atau tidak.
 */
import { KELAS } from './kelas';
import type { KodeLangkah } from './langkah-po';

/** Bentuk JSON yang diminta dari model. Semua bidang opsional: hasil baca boleh tidak lengkap. */
export type IsianScan = {
  sekolah?: Partial<Record<
    'nama' | 'npsn' | 'jenjang' | 'alamat' | 'telepon' | 'email'
    | 'kepala_sekolah' | 'kepsek_hp' | 'bendahara' | 'bendahara_hp', string>>;
  kotak_paket?: string[];
  kotak_lain?: string[];
  custom_teks?: string | null;
  harga_siswa?: number;
  harga_guru?: number;
  rombel?: { kelas?: string; rombel?: string; jumlah?: number }[];
  termin?: { tanggal?: string; nominal?: number }[];
  masa_mulai?: string;
  masa_selesai?: string;
  sumber_dana?: string;
  kota?: string;
  tanggal_ttd?: string;
  catatan?: string[];
  ragu?: string[];
  tidak_terbaca?: string[];
  peringatan?: string[];
};

export type HasilPetakan = {
  sekolah: Record<string, string>;
  /** null = tidak ada komponen yang boleh diisi dari kotak; alasannya di catatanPaket. */
  komponen: { id: string; sesi: number }[] | null;
  catatanPaket: string | null;
  harga: { siswa: number | null; guru: number | null };
  rombel: { kelas: number; rombel: string; jumlah: number }[];
  /** Bila kolom rombel di kertas lebih banyak dari bawaan wizard. */
  nRombel: number | null;
  termin: { urutan: number; tanggal: string | null; nominal: number }[];
  lain: {
    masaMulai: string | null; masaSelesai: string | null; sumberDana: string | null;
    kota: string | null; tanggalTtd: string | null;
    nilaiSponsorship?: undefined;
  };
  /** Isi catatan dari scan. JENISNYA selalu kosong: Sales yang memilih (aturan 1). */
  catatan: { isi: string; jenis: null }[];
  ragu: string[];
  tidakTerbaca: string[];
  peringatan: string[];
  /** Semua kunci isian yang datang dari scan, termasuk yang nilainya kosong. */
  dariScan: string[];
};

/** Kotak paket di kertas Form PO yang mengisi komponen (catatan/17). Nama = nama PRESET. */
export const KOTAK_PAKET = ['LMS Lite', 'LMS Smart', 'LMS Juara', 'Asesmen Psikologi'] as const;

/** Selalu dituntut centangnya, ditandai ragu atau tidak (catatan/17 aturan 4). */
export const HP_KEYS = ['sekolah.kepsek_hp', 'sekolah.bendahara_hp'] as const;

const KUNCI_LANGKAH: { langkah: KodeLangkah; kunci: string[] }[] = [
  { langkah: 'sekolah', kunci: ['sekolah.nama', 'sekolah.npsn', 'sekolah.jenjang', 'sekolah.alamat',
      'sekolah.telepon', 'sekolah.email', 'sekolah.kepala_sekolah', 'sekolah.kepsek_hp',
      'sekolah.bendahara', 'sekolah.bendahara_hp'] },
  { langkah: 'paket', kunci: ['komponen', 'harga.siswa', 'harga.guru'] },
  { langkah: 'rombel', kunci: ['rombel'] },
  { langkah: 'termin', kunci: ['termin', 'masa.mulai', 'masa.selesai', 'sumberDana'] },
  { langkah: 'penanda', kunci: ['kota', 'tanggalTtd', 'catatan'] },
];

const ROMAWI: Record<string, number> = { X: 10, XI: 11, XII: 12 };

/** Label kelas di kertas -> angka kelas jenjang. "X"/"10" -> 10; label asing -> null. */
export function kelasDari(label: string, jenjang: string): number | null {
  const ada = KELAS[jenjang];
  if (!ada) return null;
  const t = label.trim().toUpperCase().replace(/[\s-]/g, '');
  const angka = /^\d+$/.test(t) ? Number(t) : ROMAWI[t] ?? null;
  return angka !== null && angka in ada ? angka : null;
}

const hurufKe = (h: string): number | null => {
  const t = h.trim().toUpperCase();
  return /^[A-H]$/.test(t) ? t.charCodeAt(0) - 64 : null;
};

/** Tanggal ISO yang masuk akal; selain itu dibuang (catatan/17 aturan 6). */
const tanggalSah = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return null;
  const d = new Date(v.trim() + 'T00:00:00Z');
  return Number.isNaN(+d) ? null : v.trim();
};

const angkaSah = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
};

const teksSah = (v: unknown): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t === '' ? null : t;
};

const daftarTeks = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

export function petakanEkstraksi(
  m: unknown,
  p: { idsPaket: (nama: string) => string[] | null },
): HasilPetakan {
  const s = (typeof m === 'object' && m !== null ? m : {}) as IsianScan;
  const sekolahMasuk = (typeof s.sekolah === 'object' && s.sekolah !== null ? s.sekolah : {}) as Record<string, unknown>;
  const ragu = daftarTeks(s.ragu);
  const tidakTerbaca = daftarTeks(s.tidak_terbaca);
  const peringatan = daftarTeks(s.peringatan);
  const dariScan: string[] = [];

  // --- Sekolah ---
  const sekolah: Record<string, string> = {};
  for (const k of ['nama', 'npsn', 'alamat', 'telepon', 'email', 'kepala_sekolah',
                   'kepsek_hp', 'bendahara', 'bendahara_hp'] as const) {
    const t = teksSah(sekolahMasuk[k]);
    if (t !== null) { sekolah[k] = t; dariScan.push(`sekolah.${k}`); }
  }
  const jenjangKertas = teksSah(sekolahMasuk.jenjang);
  const jenjang = jenjangKertas && KELAS[jenjangKertas.toUpperCase()]
    ? jenjangKertas.toUpperCase() : null;
  if (jenjang) { sekolah.jenjang = jenjang; dariScan.push('sekolah.jenjang'); }
  else if (jenjangKertas) { tidakTerbaca.push('sekolah.jenjang'); dariScan.push('sekolah.jenjang'); }

  // --- Kotak paket ---
  // HANYA satu kotak JELAS yang dicentang yang mengisi komponen. Lebih dari satu, atau nama
  // yang tidak dikenal, berarti kertasnya ambigu: komponen dibiarkan kosong dan semuanya
  // tampil sebagai catatan supaya Sales memutuskan (catatan/17 "Kotak paket").
  const kotak = daftarTeks(s.kotak_paket);
  const jelas = kotak.filter((k) => KOTAK_PAKET.includes(k as (typeof KOTAK_PAKET)[number]));
  let komponen: HasilPetakan['komponen'] = null;
  let catatanPaket: string | null = null;
  if (kotak.length === 1 && jelas.length === 1) {
    const ids = p.idsPaket(jelas[0]);
    if (ids && ids.length) {
      komponen = ids.map((id) => ({ id, sesi: 0 }));
      dariScan.push('komponen');
    } else {
      catatanPaket = `Scan: ${jelas[0]} dicentang, tapi komposisinya tidak dikenali sistem`;
    }
  }
  const lainLabel = daftarTeks(s.kotak_lain);
  const custom = teksSah(s.custom_teks);
  const potonganCatatan = [
    ...kotak.map((k) => k),
    ...lainLabel.map((k) => `${k} dicentang`),
    ...(custom ? [`Custom: ${custom}`] : []),
  ];
  if (komponen === null && potonganCatatan.length) {
    catatanPaket = `Scan: ${potonganCatatan.join(', ')}`;
    dariScan.push('komponen');
  }

  // --- Harga ---
  const hargaSiswa = angkaSah(s.harga_siswa);
  const hargaGuru = angkaSah(s.harga_guru);
  if (hargaSiswa !== null) dariScan.push('harga.siswa');
  if (hargaGuru !== null) dariScan.push('harga.guru');

  // --- Rombel ---
  const rombel: HasilPetakan['rombel'] = [];
  let nRombel: number | null = null;
  for (const r of Array.isArray(s.rombel) ? s.rombel : []) {
    const kelas = jenjang ? kelasDari(String(r?.kelas ?? ''), jenjang) : null;
    const kolom = hurufKe(String(r?.rombel ?? ''));
    const jumlah = angkaSah(r?.jumlah);
    if (kelas === null || kolom === null || jumlah === null) { tidakTerbaca.push('rombel'); continue; }
    rombel.push({ kelas, rombel: String.fromCharCode(64 + kolom), jumlah });
    nRombel = Math.max(nRombel ?? 0, kolom);
  }
  if (rombel.length) dariScan.push('rombel');

  // --- Termin ---
  const termin: HasilPetakan['termin'] = [];
  for (const t of Array.isArray(s.termin) ? s.termin : []) {
    const nominal = angkaSah(t?.nominal);
    const tanggal = tanggalSah(t?.tanggal);
    if (nominal === null && tanggal === null) { tidakTerbaca.push('termin'); continue; }
    termin.push({ urutan: termin.length + 1, tanggal, nominal: nominal ?? 0 });
  }
  if (termin.length) dariScan.push('termin');

  // --- Masa aktif, sumber dana, kota, tanggal tanda tangan ---
  const masaMulai = tanggalSah(s.masa_mulai);
  const masaSelesai = tanggalSah(s.masa_selesai);
  if (masaMulai) dariScan.push('masa.mulai');
  if (masaSelesai) dariScan.push('masa.selesai');
  const sumberDana = teksSah(s.sumber_dana);
  if (sumberDana) dariScan.push('sumberDana');
  const kota = teksSah(s.kota);
  if (kota) dariScan.push('kota');
  const tanggalTtd = tanggalSah(s.tanggal_ttd);
  if (tanggalTtd) dariScan.push('tanggalTtd');

  // Peringatan turunan: model sendiri sudah menandai tanggal selesai yang mendahului mulai
  // (diuji 17 Sep), tetapi kalau ia lupa, layarnya tetap memberi tahu.
  if (masaMulai && masaSelesai && masaSelesai <= masaMulai) {
    peringatan.push('Tanggal selesai tidak sesudah tanggal mulai.');
  }

  // --- Catatan: isinya diisi, JENISNYA selalu kosong ---
  const isiCatatan = daftarTeks(s.catatan).map((isi) => isi.trim()).filter(Boolean);
  const catatan = isiCatatan.map((isi) => ({ isi, jenis: null as null }));
  if (catatan.length) dariScan.push('catatan');

  // Isian yang ditandai ragu atau tidak terbaca ikut ditagih walau nilainya ada.
  for (const k of [...ragu, ...tidakTerbaca]) if (!dariScan.includes(k)) dariScan.push(k);

  return {
    sekolah, komponen, catatanPaket,
    harga: { siswa: hargaSiswa, guru: hargaGuru },
    rombel, nRombel, termin,
    lain: { masaMulai, masaSelesai, sumberDana, kota, tanggalTtd },
    catatan,
    ragu, tidakTerbaca, peringatan,
    dariScan: [...new Set(dariScan)],
  };
}

/** Isian yang wajib dicentang satu per satu sebelum langkahnya boleh dikonfirmasi. */
export function wajibDicentang(h: HasilPetakan): string[] {
  const set = new Set<string>([...HP_KEYS]);
  for (const k of [...h.ragu, ...h.tidakTerbaca]) set.add(k);
  return [...set];
}

/** Lima langkah wizard yang memuat isian dari scan, urut wizard. */
export function langkahIsian(h: HasilPetakan): { langkah: KodeLangkah; kunci: string[] }[] {
  return KUNCI_LANGKAH
    .map((l) => ({ langkah: l.langkah, kunci: l.kunci.filter((k) => h.dariScan.includes(k)) }))
    .filter((l) => l.kunci.length > 0);
}
```

> **Kalau `KodeLangkah` belum diekspor `lib/langkah-po.ts`**, ekspor tipenya di tugas ini
> (satu baris `export type KodeLangkah = ...` sudah ada di sana; hanya perlu `export`).

- [ ] **Langkah 5: Jalankan uji + periksa**

Jalankan: `node --test uji/ekstraksi-po.test.mjs && npm run periksa`
Harapan: LULUS, dan `uji/batas-harga.test.mjs` tetap hijau (bukti tidak ada impor pricelist).

- [ ] **Langkah 6: Commit**

```bash
git add lib/ekstraksi-po.ts uji/ekstraksi-po.test.mjs uji/emas/ekstraksi-dummy.json
git commit -m "Ekstraksi: pemetaan hasil baca ke isian wizard, murni tanpa pricelist (catatan/25 Tugas 3)"
```

---

### Tugas 4: `lib/penyedia-ekstraksi.ts` — satu pintu ke penyedia

**Berkas:**
- Buat: `lib/penyedia-ekstraksi.ts`
- Ubah: `.env.example`

**Antarmuka:**
- Menghasilkan (dipakai Tugas 5):
  - `const MODEL_EKSTRAKSI = 'deepseek-v4-flash-vision-exp'`
  - `const PENYEDIA_EKSTRAKSI = 'OpenCode Go'`
  - `bacaScan(gambar: string[]): Promise<{ hasil: unknown; tokenMasuk: number | null; tokenKeluar: number | null }>`
    (melempar `Error` dengan pesan yang layak ditampilkan bila penyedia gagal)

- [ ] **Langkah 1: Tambahkan nama kunci ke `.env.example`**

```bash
# Hanya server. JANGAN beri awalan NEXT_PUBLIC_: nilainya tidak boleh sampai ke peramban.
OPENCODE_GO_API_KEY=
```

- [ ] **Langkah 2: Implementasi `lib/penyedia-ekstraksi.ts`**

```ts
/**
 * Satu-satunya tempat aplikasi memanggil penyedia ekstraksi (catatan/17).
 *
 * Dikurung di sini supaya penggantian penyedia cukup satu perubahan: tidak ada berkas lain yang
 * tahu nama host, bentuk permintaan, atau nama model. Modul ini hanya boleh diimpor berkas
 * server; `uji/pindai-bundel.mjs` menolak nama kunci dan hostnya muncul di chunk klien.
 *
 * DeepSeek V4 Flash Vision lewat OpenCode Go. Tanpa DPA: risiko diterima Rizki 17 Sep 2026 dan
 * dicatat di gerbang organisasi, bukan di sini.
 */

export const MODEL_EKSTRAKSI = 'deepseek-v4-flash-vision-exp';
export const PENYEDIA_EKSTRAKSI = 'OpenCode Go';

const ALAMAT = 'https://opencode.ai/zen/go/v1/chat/completions';

/** ID sesi stabil; permintaan tanpa header ini dijawab 400 MissingSessionID. */
const SESI = 'skolla-kerjasama-ekstraksi';
const AGEN = 'skolla-kerjasama/1.0 (+https://skolla-kerjasama.vercel.app)';

/** Permintaan skema JSON yang diminta: lihat IsianScan di lib/ekstraksi-po.ts. */
const PERMINTAAN = `Kamu membaca pindaian Form Pre Order (PO) Skolla yang diisi tangan dan \
ditandatangani. Balas HANYA satu objek JSON, tanpa penjelasan, tanpa pagar kode.

Kunci yang boleh ada:
{"sekolah":{"nama","npsn","jenjang","alamat","telepon","email","kepala_sekolah","kepsek_hp",\
"bendahara","bendahara_hp"},"kotak_paket":[],"kotak_lain":[],"custom_teks":null,\
"harga_siswa":0,"harga_guru":0,"rombel":[{"kelas","rombel","jumlah"}],\
"termin":[{"tanggal","nominal"}],"masa_mulai":null,"masa_selesai":null,"sumber_dana":null,\
"kota":null,"tanggal_ttd":null,"catatan":[],"ragu":[],"tidak_terbaca":[],"peringatan":[]}

Aturan:
- Tanggal dalam bentuk YYYY-MM-DD. Yang tidak terurai JANGAN ditebak: masukkan kuncinya ke \
"tidak_terbaca".
- "kotak_paket" hanya berisi label kotak yang JELAS tercentang, dari: LMS Lite, LMS Smart, \
LMS Juara, Asesmen Psikologi. Kotak lain (TKA, UTBK, ANBK, Custom) masuk "kotak_lain"; teks di \
sebelah Custom masuk "custom_teks".
- "ragu": kunci isian yang kamu sendiri tidak yakin. Nomor HP yang tidak yakin JANGAN didiamkan.
- "peringatan": hal yang perlu diperiksa manusia, misalnya tabel termin tidak rapi.
- Jangan mengisi apa pun yang tidak ada di kertas.`;

type Balasan = {
  choices?: { message?: { content?: string } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};

/**
 * Membaca halaman-halaman scan (JPEG dalam base64, tanpa awalan data:) dan mengembalikan JSON
 * mentah model yang sudah diurai. Melempar bila penyedia menjawab galat, lewat batas waktu, atau
 * balasannya bukan JSON yang sah.
 */
export async function bacaScan(gambar: string[]): Promise<{
  hasil: unknown; tokenMasuk: number | null; tokenKeluar: number | null;
}> {
  const kunci = process.env.OPENCODE_GO_API_KEY;
  if (!kunci) throw new Error('Kunci penyedia ekstraksi belum dipasang di server.');

  // Batas waktu 60 detik; uji terlama 34 detik (catatan/17 "Kegagalan").
  const batal = AbortSignal.timeout(60_000);
  const balasan = await fetch(ALAMAT, {
    method: 'POST',
    signal: batal,
    headers: {
      'Authorization': `Bearer ${kunci}`,
      'Content-Type': 'application/json',
      // Wajib: tanpa ini penyedia menjawab 400 MissingSessionID.
      'x-opencode-session': SESI,
      'User-Agent': AGEN,
    },
    body: JSON.stringify({
      model: MODEL_EKSTRAKSI,
      response_format: { type: 'json_object' },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PERMINTAAN },
          ...gambar.map((g) => ({
            type: 'image_url' as const,
            image_url: { url: `data:image/jpeg;base64,${g}` },
          })),
        ],
      }],
    }),
  });

  if (!balasan.ok) {
    // Pesan penyedia TIDAK pernah memuat gambar atau isi scan; aman ditampilkan.
    throw new Error(`Penyedia menjawab ${balasan.status}.`);
  }

  const muatan = (await balasan.json()) as Balasan;
  const isi = muatan.choices?.[0]?.message?.content;
  if (typeof isi !== 'string' || isi.trim() === '') {
    throw new Error('Penyedia tidak mengembalikan isi.');
  }
  let hasil: unknown;
  try {
    hasil = JSON.parse(isi);
  } catch {
    // Hasil yang sah secara JSON tetapi tidak sesuai skema ditangani pemetaan (satu per satu);
    // yang tidak bisa diurai sama sekali adalah kegagalan pembacaan.
    throw new Error('Balasan penyedia bukan JSON yang sah.');
  }
  return {
    hasil,
    tokenMasuk: muatan.usage?.prompt_tokens ?? null,
    tokenKeluar: muatan.usage?.completion_tokens ?? null,
  };
}
```

> **Kalau endpoint atau nama model bergeser**, ubah HANYA berkas ini. Fakta yang sudah terbukti
> pada spike 17 Sep 2026: endpoint itu menuntut header `x-opencode-session` dan User-Agent klien
> yang jujur, `response_format: json_object` diterima, dan waktu jawab 17-34 detik.

- [ ] **Langkah 3: Pastikan modul server tidak bocor ke klien**

Jalankan: `npm run periksa`
Harapan: LULUS. `uji/batas-klien.test.mjs` menolak modul klien mengimpor berkas ini; kalau ia
mengeluh, berarti ada komponen klien yang mengimpor `penyedia-ekstraksi` dan impor itu harus
dipindah ke balik Server Action (Tugas 5).

- [ ] **Langkah 4: Commit**

```bash
git add lib/penyedia-ekstraksi.ts .env.example
git commit -m "Ekstraksi: satu pintu ke penyedia, tanpa DPA, kunci hanya di server (catatan/25 Tugas 4)"
```

---

### Tugas 5: Server Actions klaim-baca-tautkan, dan penyaring bundel

**Berkas:**
- Buat: `lib/ekstraksi-aksi.ts`
- Ubah: `uji/pindai-bundel.mjs`
- Uji: `uji/ekstraksi-bundel.test.mjs`

**Antarmuka:**
- Mengonsumsi: `klaim_ekstraksi`/`selesai_ekstraksi`/`tautkan_ekstraksi` (Tugas 2), `bacaScan`
  (Tugas 4), `petakanEkstraksi` dan `IsianScan` (Tugas 3).
- Menghasilkan (dipakai Tugas 6):
  - `bacaScanPo(gambar: string[]): Promise<HasilBaca>` dengan
    `type HasilBaca = { ok: true; klaimId: string; hasil: unknown } | { ok: false; galat: string }`
  - `tautkanEkstraksi(klaimId: string, poId: string): Promise<{ ok: boolean; galat?: string }>`

- [ ] **Langkah 1: Tulis uji penjaga bundel yang gagal**

`uji/ekstraksi-bundel.test.mjs`:

```js
// Nama kunci dan host penyedia TIDAK boleh muncul di kode yang dikirim ke peramban, dan modul
// klien tidak boleh mengimpor berkas penyedia. Pengganti cepat untuk pindai-bundel.mjs, yang
// butuh build; keduanya dijalankan di Tugas 11.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AKAR = new URL('..', import.meta.url).pathname;
const TERLARANG = ['OPENCODE_GO_API_KEY', 'opencode.ai'];

const berkas = [];
(function jalan(d) {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) jalan(p);
    else if (/\.(ts|tsx)$/.test(n)) berkas.push(p);
  }
})(join(AKAR, 'app'), join(AKAR, 'lib'));

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// 'use client' pada baris pertama = komponen klien; seluruh graf impornya sampai ke peramban.
const klien = berkas.filter((f) => /^\s*['"]use client['"]/m.test(readFileSync(f, 'utf8').slice(0, 200)));
const pelanggar = klien.filter((f) => /penyedia-ekstraksi/.test(readFileSync(f, 'utf8')));
assert.deepEqual(pelanggar, [], 'komponen klien mengimpor modul penyedia:\n  ' + pelanggar.join('\n  '));
ok(`${klien.length} berkas klien tidak mengimpor modul penyedia`);

const bocor = berkas.filter((f) => {
  const s = readFileSync(f, 'utf8');
  // Nama kunci boleh disebut di penyedia-ekstraksi.ts (server) dan di uji; sisanya terlarang.
  if (f.endsWith('lib/penyedia-ekstraksi.ts')) return false;
  return TERLARANG.some((t) => s.includes(t)) && /^\s*['"]use client['"]/m.test(s);
});
assert.deepEqual(bocor, []);
ok('nama kunci dan host penyedia tidak ada di berkas klien mana pun');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/ekstraksi-bundel.test.mjs`
Harapan: gagal hanya bila ada pelanggaran. Kalau hijau sekarang (belum ada kode klien yang
menyentuh penyedia), **loloskan langkah ini sebagai hijau-duluan** dan catat di pesan commit
bahwa uji ini adalah penjaga untuk Tugas 6; yang wajib dibuktikan menangkap pada Tugas 6
langkah terakhir.

- [ ] **Langkah 3: Perluas `uji/pindai-bundel.mjs`**

Tambahkan di akhir berkas, sebelum baris `console.log` penutup terakhir:

```js
// Sejak ekstraksi scan (catatan/25): nama kunci penyedia dan hostnya tidak boleh sampai ke
// bundel klien. Pemeriksaan angka Acquisition di atas tidak menangkapnya, karena yang bocor
// bukan harga melainkan kuasa memanggil penyedia.
const TERLARANG = ['OPENCODE_GO_API_KEY', 'opencode.ai', 'deepseek-v4-flash-vision-exp'];
const bocorKunci = [];
for (const f of chunk) {
  const s = readFileSync(f, 'utf8');
  for (const t of TERLARANG) {
    if (s.includes(t)) bocorKunci.push(`${f.slice(AKAR.length)} memuat ${t}`);
  }
}
if (bocorKunci.length) {
  console.error('KUNCI PENYEDIA TERKIRIM KE PERAMBAN:\n  ' + bocorKunci.join('\n  '));
  process.exit(1);
}
console.log(`  OK  ${chunk.length} chunk klien bersih dari nama kunci penyedia`);
```

- [ ] **Langkah 4: Implementasi `lib/ekstraksi-aksi.ts`**

```ts
'use server';

/**
 * Server Actions ekstraksi scan (catatan/17 amandemen 3: baca dulu, simpan sesudahnya).
 *
 * Dua tindakan, dan urutannya yang penting:
 *   1. bacaScanPo()  dipanggil dari langkah 0, SEBELUM draf ada. Klaim dulu, baru panggil
 *      penyedia, supaya tab kedua atau klik ganda tidak mengirim scan dua kali.
 *   2. tautkanEkstraksi() dipanggil SESUDAH draf dan pindaiannya ada, dan hanya sekali.
 *
 * Gambar datang dari peramban (halaman PDF dirender jadi JPEG) dan hanya hidup di memori
 * permintaan; tidak ada gambar yang disimpan (catatan/17 "Perlindungan" butir 5).
 */
import { supabaseServer, penggunaSaatIni } from './supabase-server';
import { bacaScan } from './penyedia-ekstraksi';

export type HasilBaca =
  | { ok: true; klaimId: string; hasil: unknown }
  | { ok: false; galat: string };

/**
 * Sesi diperiksa lebih dulu supaya jawabannya kalimat manusia, bukan galat RLS. Pola aksi server
 * di proyek ini (catatan/12): balas pesan di tempat, JANGAN melempar, supaya isian formulir yang
 * belum tersimpan tidak hilang. RPC-nya sendiri tetap menolak sesi tanpa peran; ini lapis pertama.
 */
async function siapkan(): Promise<{ ok: true; sb: Awaited<ReturnType<typeof supabaseServer>> } | { ok: false; galat: string }> {
  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };
  return { ok: true, sb: await supabaseServer() };
}

export async function bacaScanPo(gambar: string[]): Promise<HasilBaca> {
  if (!Array.isArray(gambar) || gambar.length === 0) {
    return { ok: false, galat: 'Tidak ada halaman yang bisa dibaca.' };
  }
  // Batas badan Server Action di aplikasi ini 1 MB (lib/pks-aksi.ts); JPEG-nya sudah dikompres
  // di peramban sampai di bawah itu. Ini pagar kedua supaya permintaan raksasa tidak dikirim.
  const bobot = gambar.reduce((a, g) => a + g.length, 0);
  if (bobot > 900_000) return { ok: false, galat: 'Gambar scan terlalu besar untuk dikirim.' };

  const siap = await siapkan();
  if (!siap.ok) return siap;
  const { sb } = siap;

  const { data: klaim, error: e1 } = await sb.rpc('klaim_ekstraksi');
  if (e1 || !klaim) return { ok: false, galat: manusiawi(e1?.message, 'Pembacaan scan belum bisa dimulai.') };
  const klaimId = klaim as string;

  const mulai = Date.now();
  try {
    const { hasil, tokenMasuk, tokenKeluar } = await bacaScan(gambar);
    await sb.rpc('selesai_ekstraksi', {
      p_id: klaimId, p_berhasil: true, p_hasil: hasil, p_galat: null,
      p_durasi_ms: Date.now() - mulai, p_token_masuk: tokenMasuk, p_token_keluar: tokenKeluar,
    });
    return { ok: true, klaimId, hasil };
  } catch (e) {
    const pesan = e instanceof Error ? e.message : 'Pembacaan gagal.';
    await sb.rpc('selesai_ekstraksi', {
      p_id: klaimId, p_berhasil: false, p_hasil: null, p_galat: pesan,
      p_durasi_ms: Date.now() - mulai, p_token_masuk: null, p_token_keluar: null,
    });
    return { ok: false, galat: pesan };
  }
}

export async function tautkanEkstraksi(klaimId: string, poId: string): Promise<{ ok: boolean; galat?: string }> {
  const siap = await siapkan();
  if (!siap.ok) return { ok: false, galat: siap.galat };
  const { error } = await siap.sb.rpc('tautkan_ekstraksi', { p_id: klaimId, p_po: poId });
  if (error) return { ok: false, galat: manusiawi(error.message, 'Gagal menautkan hasil pembacaan.') };
  return { ok: true };
}

/** Pesan basis data diterjemahkan jadi kalimat yang layak dibaca Sales. */
function manusiawi(pesan: string | undefined, cadangan: string): string {
  if (!pesan) return cadangan;
  if (pesan.includes('belum dinyalakan')) return 'Pembacaan scan dengan AI belum dinyalakan. Ketik seperti biasa.';
  if (pesan.includes('Batas 20')) return 'Batas 20 pembacaan scan per hari sudah tercapai. Ketik seperti biasa.';
  return cadangan;
}
```

- [ ] **Langkah 5: Jalankan uji + periksa**

Jalankan: `node --test uji/ekstraksi-bundel.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 6: Commit**

```bash
git add lib/ekstraksi-aksi.ts uji/pindai-bundel.mjs uji/ekstraksi-bundel.test.mjs
git commit -m "Ekstraksi: klaim-baca-tautkan di server, penyaring bundel diperluas (catatan/25 Tugas 5)"
```

---

### Tugas 6: Langkah 0 di wizard - kotak "Baca scan" dan render PDF ke JPEG

**Berkas:**
- Buat: `app/(sistem)/po/baru/baca-scan.tsx`
- Buat: `lib/render-pdf.ts`
- Buat: `public/pdf.worker.min.mjs` (salinan dari `node_modules/pdfjs-dist/build/`)
- Ubah: `app/(sistem)/po/baru/langkah/cara.tsx`
- Ubah: `app/(sistem)/po/baru/use-form-po.ts`
- Ubah: `app/(sistem)/po/baru/form-po.tsx`
- Ubah: `app/(sistem)/po/baru/page.tsx`
- Ubah: `app/(sistem)/po/baru/penampil-scan.tsx`
- Ubah: `package.json` (`pdfjs-dist`)
- Uji: `uji/render-pdf.test.mjs`

**Antarmuka:**
- Mengonsumsi: `bacaScanPo` (Tugas 5), `petakanEkstraksi` (Tugas 3).
- Menghasilkan (dipakai Tugas 8):
  - `PropsFormPo.gerbangEkstraksi: boolean`
  - di hook: `ekstraksi: HasilPetakan | null`, `setEkstraksi`, `klaimId: string | null`,
    `bacaPindaian(): Promise<void>`, `sedangBaca: boolean`, `galatBaca: string | null`,
    `pemberitahuanAi: boolean`, `setPemberitahuanAi`.

- [ ] **Langkah 1: Pasang `pdfjs-dist`**

```bash
npm install pdfjs-dist
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

Tambahkan catatan di `AGENTS.md` bagian "Menjalankan, menguji, merilis":
`public/pdf.worker.min.mjs` disalin manual dari `pdfjs-dist`; naikkan berkas itu setiap kali
`pdfjs-dist` diperbarui.

- [ ] **Langkah 2: Tulis uji yang gagal**

`uji/render-pdf.test.mjs`:

```js
// Aturan ukuran gambar adalah aturan yang menentukan permintaan diterima atau ditolak Server
// Action (batas 1 MB). Diuji sebagai fungsi murni: peramban tidak bisa dipanggil dari node.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const { langkahTurun, MUTU, MAKS_PANJANG } = muat('render-pdf');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

// Halaman A4 pada 150 dpi = 1240x1754 px: cukup terbaca model, muat di bawah batas.
assert.deepEqual(langkahTurun(1240, 1754), { lebar: 1240, tinggi: 1754 });
ok('halaman pada 150 dpi dikirim apa adanya');

// Halaman yang lebih lebar dari MAKS_PANJANG diperkecil dengan rasio yang sama.
const besar = langkahTurun(2480, 3508);
assert.ok(Math.max(besar.lebar, besar.tinggi) <= MAKS_PANJANG, 'hasil harus <= MAKS_PANJANG');
assert.ok(Math.abs(besar.lebar / besar.tinggi - 2480 / 3508) < 0.001, 'rasio harus dijaga');
ok('halaman besar diperkecil dengan rasio dijaga');

assert.ok(MUTU > 0.5 && MUTU <= 0.8, 'mutu JPEG harus hemat tapi masih terbaca');
console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 3: Jalankan, pastikan gagal**

Jalankan: `node --test uji/render-pdf.test.mjs`
Harapan: GAGAL (`Cannot find module ... lib/render-pdf.ts`).

- [ ] **Langkah 4: Implementasi `lib/render-pdf.ts`**

```ts
/**
 * Merender halaman PDF menjadi JPEG di PERAMBAN (catatan/17 amandemen 3).
 *
 * Di peramban, bukan di server: merender di server berarti menambah langkah Chromium yang berat
 * di setiap permintaan, dan langkah itu sudah cukup mahal untuk PDF PKS (5,5 detik hanya untuk
 * meluncurkan Chromium, catatan/30 Agu). Modul ini dipisah dari komponen supaya aturan ukurannya
 * bisa diuji tanpa peramban.
 */
export const MUTU = 0.72;
export const MAKS_PANJANG = 1600;
/** Halaman dirender pada 150 dpi: cukup untuk tulisan tangan, tidak menembus batas 1 MB. */
export const DPI = 150;

/** Ukuran gambar yang benar-benar dikirim ke penyedia; rasionya dijaga. */
export function langkahTurun(lebar: number, tinggi: number): { lebar: number; tinggi: number } {
  const terpanjang = Math.max(lebar, tinggi);
  if (terpanjang <= MAKS_PANJANG) return { lebar, tinggi };
  const skala = MAKS_PANJANG / terpanjang;
  return { lebar: Math.round(lebar * skala), tinggi: Math.round(tinggi * skala) };
}

/** Halaman PDF (ArrayBuffer) menjadi daftar JPEG base64, tanpa awalan data:. */
export async function halamanKeJpeg(berkas: ArrayBuffer): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const dok = await pdfjs.getDocument({ data: berkas }).promise;
  const hasil: string[] = [];
  for (let i = 1; i <= dok.numPages; i++) {
    const halaman = await dok.getPage(i);
    const dasar = halaman.getViewport({ scale: DPI / 72 });
    const { lebar, tinggi } = langkahTurun(Math.round(dasar.width), Math.round(dasar.height));
    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext('2d');
    if (!ctx) throw new Error('Kanvas tidak tersedia di peramban ini.');
    // Latar putih: JPEG tidak punya kanal alfa, dan latar transparan jadi hitam.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lebar, tinggi);
    await halaman.render({
      canvasContext: ctx,
      viewport: halaman.getViewport({ scale: (DPI / 72) * (lebar / Math.round(dasar.width)) }),
    } as unknown as Parameters<typeof halaman.render>[0]).promise;
    const dataUrl = kanvas.toDataURL('image/jpeg', MUTU);
    hasil.push(dataUrl.slice(dataUrl.indexOf(',') + 1));
  }
  return hasil;
}
```

- [ ] **Langkah 5: Jalankan uji + periksa**

Jalankan: `node --test uji/render-pdf.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 6: Komponen `baca-scan.tsx`**

```tsx
'use client';

/**
 * Kotak "Baca scan dengan AI" di langkah 0 (catatan/17 amandemen 3).
 *
 * HANYA tampil saat gerbang organisasi menyala, dan hanya saat MEMBUAT PO unggahan: scan PO yang
 * sudah ada tidak pernah dibaca ulang. Tanpa menekan tombol ini, Sales mengetik seperti hari ini.
 */
import { useState } from 'react';
import { halamanKeJpeg } from '@/lib/render-pdf';
import { bacaScanPo } from '@/lib/ekstraksi-aksi';
import type { PropsLangkah } from './use-form-po';

export default function BacaScan({ f }: { f: PropsLangkah['f'] }) {
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);

  if (!f.gerbangEkstraksi || !f.pindaian) return null;

  async function baca() {
    setPesan(null);
    setSibuk(true);
    try {
      const berkas = await f.pindaian!.arrayBuffer();
      const gambar = await halamanKeJpeg(berkas);
      const hasil = await bacaScanPo(gambar);
      if (!hasil.ok) { setPesan(hasil.galat); return; }
      f.pasangEkstraksi(hasil.klaimId, hasil.hasil);
      setPesan('Scan terbaca. Periksa setiap isian terhadap pindaiannya.');
    } catch {
      setPesan('Scan tidak terbaca, lanjutkan dengan mengetik.');
    } finally {
      setSibuk(false);
    }
  }

  return (
    <div className="kotak" style={{ padding: '12px 16px', marginTop: 12 }}>
      <label className="baris">
        <input type="checkbox" checked={f.pemberitahuanAi}
          onChange={(e) => f.setPemberitahuanAi(e.target.checked)} />
        <span>
          <span className="nama">Sekolah sudah diberi tahu bahwa PO ini dibaca layanan AI</span>
          <span className="meta">
            Pindaian memuat nama, nomor HP, dan tanda tangan. Isian yang dihasilkan tetap harus
            kamu periksa; tidak ada yang masuk sistem tanpa kamu konfirmasi.
          </span>
        </span>
      </label>
      <button className="tombol" type="button" onClick={baca}
        disabled={!f.pemberitahuanAi || sibuk}>
        {sibuk ? 'Membaca scan, sekitar 30 detik…' : 'Baca scan'}
      </button>
      {pesan && <p className="muted" style={{ margin: '8px 0 0', fontSize: 13 }}>{pesan}</p>}
    </div>
  );
}
```

Sisipkan ke `langkah/cara.tsx` tepat sesudah blok pemilih berkas (`input type="file"`) dan
sebelum centang "Form kertas lama": `<BacaScan f={f} />`.

- [ ] **Langkah 7: Sambungkan ke hook dan halaman**

Di `use-form-po.ts` tambahkan state dan tindakannya:

```ts
const [ekstraksi, setEkstraksi] = useState<HasilPetakan | null>(null);
const [klaimId, setKlaimId] = useState<string | null>(null);
const [pemberitahuanAi, setPemberitahuanAi] = useState(false);
```

dan di objek kembalian, tambahkan:

```ts
ekstraksi, klaimId, pemberitahuanAi, setPemberitahuanAi,
pasangEkstraksi: (id: string, hasil: unknown) => {
  setKlaimId(id);
  setEkstraksi(petakanEkstraksi(hasil, {
    // Himpunan ids paket datang dari preset yang SUDAH dipotong Acquisition untuk peran ini.
    idsPaket: (nama) => props.preset.find((p) => p.n === nama)?.ids ?? null,
  }));
},
```

Di `PropsFormPo` tambahkan `gerbangEkstraksi: boolean;`, dan di `page.tsx` isi dengan bacaan
gerbang. `page.tsx` belum punya klien Supabase, jadi tambahkan impornya sekalian:

```tsx
import { supabaseServer, wajib } from '@/lib/supabase-server';

// Batas 60 detik panggilan penyedia plus selisih render PDF di peramban (catatan/17 "Kegagalan").
// Dinaikkan pada HALAMAN, bukan pada berkas aksi: batas waktu Server Action mengikuti segmen
// rute yang memicunya.
export const maxDuration = 90;
```

lalu di dalam komponen, sesudah `penggunaHalaman()`:

```tsx
  const sb = await supabaseServer();
  // Gerbang organisasi (catatan/17). Dibungkus wajib() seperti kueri baca lain di halaman ini:
  // galat baca harus sampai ke error.tsx, bukan tampil sebagai "ekstraksi mati" yang menyesatkan.
  // Gagal membaca memang berarti mati, tetapi lewat error.tsx supaya sebabnya terlihat.
  const { data: gerbang } = wajib(await sb.from('pengaturan_ekstraksi')
    .select('menyala').order('id', { ascending: false }).limit(1).maybeSingle());
```

lalu teruskan `gerbangEkstraksi={gerbang?.menyala === true}` ke `<FormPo>`.

Di `form-po.tsx`, saat `f.ekstraksi` baru terpasang, lompat ke langkah sekolah dan tampilkan
peringatan AI: ubah efek yang membaca hasil menjadi

```tsx
useEffect(() => {
  if (!f.ekstraksi) return;
  ke('sekolah');
}, [f.ekstraksi]);
```

- [ ] **Langkah 8: Ukur bobot gambar sungguhan, lalu periksa mata dua tema di 1200 dan 375**

Spesifikasi menuntut ukurannya **diuji**, bukan diperkirakan (catatan/17 alur butir 2b). Buat satu
PDF rekaan tiga halaman (Form PO kosong yang dipindai/diekspor, **tanpa data asli**), jalankan
`halamanKeJpeg` di peramban, dan catat dua angka di dalam kode sebagai komentar di
`lib/render-pdf.ts`:

1. jumlah byte base64 untuk tiga halaman;
2. waktu render.

Harapan: jauh di bawah batas 900.000 byte di `bacaScanPo`. Kalau lewat, turunkan `MAKS_PANJANG`
atau `MUTU`, **jangan** menaikkan batas badan Server Action. Kalau ternyata di bawah 300.000 byte,
naikkan `MUTU` sedikit demi keterbacaan tulisan tangan lalu ukur lagi. Angka hasil ukurannya
masuk `HANDOFF.md` supaya pengukuran berikutnya punya pembanding.

Lalu: `node uji/pratinjau-wizard.tsx > _wizard-baca-scan-terang.html` dengan prop
`gerbangEkstraksi: true` dan `ekstraksi` terisi (tambahkan kasing di `uji/pratinjau-wizard.tsx`),
dan ukur di peramban: kotak tidak meluber di 375, dan centang wajib benar-benar mematikan
tombol. Aturan yang berlaku: pratinjau statis WAJIB punya `<meta viewport>` (tanpa itu selalu
hijau palsu), dan tata letak dinilai dengan ANGKA (`scrollWidth` vs `clientWidth`), bukan
perasaan — QA independen pernah salah membaca luberan 307px sebagai "disengaja".

- [ ] **Langkah 9: Commit**

```bash
git add app/\(sistem\)/po/baru/baca-scan.tsx app/\(sistem\)/po/baru/langkah/cara.tsx \
        app/\(sistem\)/po/baru/use-form-po.ts app/\(sistem\)/po/baru/form-po.tsx \
        app/\(sistem\)/po/baru/page.tsx app/\(sistem\)/po/baru/penampil-scan.tsx \
        lib/render-pdf.ts public/pdf.worker.min.mjs uji/render-pdf.test.mjs \
        uji/pratinjau-wizard.tsx package.json package-lock.json AGENTS.md
git commit -m "Ekstraksi: langkah 0 membaca scan sebelum draf ada (catatan/25 Tugas 6)"
```

---

### Tugas 7: `po.ekstraksi_menunggu` dan penautan sesudah simpan pertama

**Berkas:**
- Buat: `supabase/migrasi/20260926c_konfirmasi_langkah.sql`
- Buat: `supabase/migrations/20260926030000_konfirmasi_langkah.sql`
- Ubah: `lib/po-aksi.ts` (`IsiPo`, `simpanDraf`)
- Ubah: `lib/isi-po-form.ts` (`MasukanIsiPo`, `susunIsiPo`)
- Ubah: `app/(sistem)/po/baru/use-form-po.ts` (`simpan()`)
- Uji: `uji/isi-po.test.mjs` (rekaman emas kiriman; jangan diubah isinya, tambahkan kasing)

**Antarmuka:**
- Mengonsumsi: `tautkanEkstraksi` (Tugas 5).
- Menghasilkan (dipakai Tugas 8):
  - kolom `po.ekstraksi_menunggu text[]`
  - `IsiPo.ekstraksiMenunggu?: string[]`

- [ ] **Langkah 1: Tulis migrasinya**

`supabase/migrasi/20260926c_konfirmasi_langkah.sql`:

```sql
-- Status konfirmasi per langkah disimpan bersama draf (catatan/17 amandemen 2 butir 5).
--
-- Isinya DAFTAR KUNCI isian yang masih menunggu konfirmasi Sales, bukan hasil baca AI. Hasil
-- mentah tetap hanya terbaca Super Admin (tabel ekstraksi_po); yang disimpan di sini hanya
-- "apa yang belum diperiksa", dan itu tidak membocorkan apa pun yang belum diketahui Sales.
alter table po add column if not exists ekstraksi_menunggu text[];

comment on column po.ekstraksi_menunggu is
  'Kunci isian dari scan yang belum dikonfirmasi Sales (catatan/17 amandemen 2). Kosong = semua '
  'langkah sudah dikonfirmasi. Penanda kemajuan layar, bukan isi dokumen.';

-- Pembekuan: kolom baru masuk KEDUA tuple. Ditulis di atas versi 20260926a.
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
      NEW.skema_ttd, NEW.nama_rh, NEW.dibaca_ai_pada, NEW.ekstraksi_menunggu)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor,
      OLD.asal, OLD.berkas_unggahan, OLD.ditinjau_pada, OLD.ditinjau_oleh,
      OLD.permintaan_tambahan, OLD.versi_iom, OLD.nilai_sponsorship,
      OLD.skema_ttd, OLD.nama_rh, OLD.dibaca_ai_pada, OLD.ekstraksi_menunggu)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $function$;

-- Sidik tinjauan: kolom ini dikeluarkan SELALU, bukan hanya saat kosong. Ia berubah justru saat
-- Sales mencentang, dan itu bukan perubahan isi PO: menguncinya di dalam sidik akan membatalkan
-- pernyataan "sesuai pindaian" hanya karena Sales menyelesaikan centangannya.
-- Ditulis di atas versi 20260926a.
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
                               'skema_ttd', 'ekstraksi_menunggu'])
          - case when p.nama_rh is null then 'nama_rh' else '' end
          - case when p.dibaca_ai_pada is null then 'dibaca_ai_pada' else '' end,
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
```

- [ ] **Langkah 2: Salin byte-identik, lalu buktikan**

```bash
cp supabase/migrasi/20260926c_konfirmasi_langkah.sql \
   supabase/migrations/20260926030000_konfirmasi_langkah.sql
uji/db-lokal/jalankan-bukti-ekstraksi.sh
node --test uji/ekstraksi-migrasi.test.mjs && npm run periksa
```

Harapan: P9 tetap tidak berselisih (inilah alasan kolom ini dikeluarkan selalu), dan penjaga
`ekstraksi-migrasi.test.mjs` lulus. Perluas penjaga itu di tugas ini: `bekukan_isi_po` sekarang
memuat tiga kolom baru, jadi hitungan `dibaca_ai_pada` tetap 2 dan tambahkan asersi
`ekstraksi_menunggu` juga 2.

- [ ] **Langkah 3: Teruskan lewat `IsiPo` dan `susunIsiPo`**

Di `lib/po-aksi.ts`, tambahkan ke `IsiPo`: `ekstraksiMenunggu?: string[];`

Di `lib/isi-po-form.ts`, tambahkan `ekstraksiMenunggu: string[] | null;` ke `MasukanIsiPo` dan
di `susunIsiPo`:

```ts
// Hanya terkirim bila ada isinya: kiriman PO lain tetap byte-identik dengan rekaman emasnya.
...(p.ekstraksiMenunggu?.length ? { ekstraksiMenunggu: p.ekstraksiMenunggu } : {}),
```

- [ ] **Langkah 4: Tulis kolomnya di `simpanDraf`**

Di `simpanDraf`, pada cabang yang menyusun baris `po` untuk INSERT dan UPDATE, tambahkan
`ekstraksi_menunggu: isi.ekstraksiMenunggu ?? null`. Jangan tambahkan ke `periksa()`: kolom ini
penanda kemajuan, bukan aturan bisnis.

- [ ] **Langkah 5: Tautkan sesudah simpan pertama**

Di `simpan()` (`use-form-po.ts`), tepat sesudah blok unggah pindaian dan
`catatUnggahanPo` berhasil, dan **sebelum** blok `sesuaiPindaian`:

```ts
// Hasil baca AI ditautkan SESUDAH draf dan pindaiannya ada (catatan/17 amandemen 3). Gagal
// menautkan tidak menghalangi Sales menyimpan: PO-nya tetap draf yang bisa diketik penuh,
// hanya penandanya yang tidak terpasang.
if (asal === 'unggahan' && klaimId) {
  const t = await tautkanEkstraksi(klaimId, hasil.id);
  if (!t.ok) setPesan({ baik: false, isi: [t.galat ?? 'Hasil pembacaan tidak tertaut.'] });
}
```

- [ ] **Langkah 6: Jalankan gerbang**

Jalankan: `npm run periksa`
Harapan: LULUS, termasuk `uji/isi-po.test.mjs` yang menjaga kiriman tetap identik untuk PO non
ekstraksi.

- [ ] **Langkah 7: Commit**

```bash
git add supabase/migrasi/20260926c_konfirmasi_langkah.sql \
        supabase/migrations/20260926030000_konfirmasi_langkah.sql \
        lib/po-aksi.ts lib/isi-po-form.ts app/\(sistem\)/po/baru/use-form-po.ts \
        uji/ekstraksi-migrasi.test.mjs
git commit -m "Ekstraksi: penautan sesudah simpan pertama dan status konfirmasi tersimpan (catatan/25 Tugas 7)"
```

---

### Tugas 8: Konfirmasi per langkah dan centang isian berisiko

**Berkas:**
- Buat: `app/(sistem)/po/baru/konfirmasi-langkah.tsx`
- Ubah: `app/(sistem)/po/baru/langkah/{sekolah,paket,rombel,termin,penanda}.tsx`
- Ubah: `app/(sistem)/po/baru/langkah/tinjau.tsx`
- Ubah: `app/(sistem)/po/baru/use-form-po.ts`
- Ubah: `app/(sistem)/po/baru/isian.tsx` (penanda per isian)
- Uji: `uji/konfirmasi-langkah.test.mjs`

**Antarmuka:**
- Mengonsumsi: `HasilPetakan`, `wajibDicentang`, `langkahIsian` (Tugas 3); `po.ekstraksi_menunggu` (Tugas 7).
- Menghasilkan:
  - `lib/ekstraksi-po.ts` tambahan: `sisaSetelahDikonfirmasi(sisa: string[], langkah: KodeLangkah,
    kunciLangkah: string[]): string[]`, `sisaSetelahDicentang(sisa: string[], kunci: string): string[]`,
    `terkunciRisiko(sisa: string[], langkah: KodeLangkah): string[]`, dan
    `layakTinjau(sisa: string[], catatanTanpaJenis: string[], langkahTerkunci: KodeLangkah[]): boolean`
  - di hook: `sisa: string[]`, `kunciLangkah(k: KodeLangkah): string[]`, `konfirmasiLangkah(k: KodeLangkah): void`,
    `centang(kunci: string): void`, `sudahDikonfirmasi(k: KodeLangkah): boolean`,
    `terkunciRisiko(k: KodeLangkah): string[]`, `catatanTanpaJenis: string[]`,
    `langkahTerkunci: KodeLangkah[]`

- [ ] **Langkah 1: Tulis uji yang gagal**

`uji/konfirmasi-langkah.test.mjs`:

```js
// Aturan konfirmasi per langkah (catatan/17 amandemen 2). Fungsi murni: sisa diturunkan dari
// daftar kunci, sehingga aturannya bisa diuji tanpa peramban.
import assert from 'node:assert/strict';
import { muat } from './muat.mjs';

const E = muat('ekstraksi-po');

let n = 0;
const ok = (l) => { console.log('  OK  ' + l); n++; };

const sisa0 = ['sekolah.nama', 'sekolah.kepsek_hp', 'sekolah.bendahara_hp', 'komponen', 'rombel'];

// Tombol langkah TIDAK bisa ditekan selama centang berisiko di langkah itu belum lengkap.
const terkunci = E.terkunciRisiko(sisa0, 'sekolah');
assert.deepEqual(terkunci.sort(), ['sekolah.bendahara_hp', 'sekolah.kepsek_hp']);
ok('dua nomor HP menahan konfirmasi langkah Sekolah');

const terkunciPaket = E.terkunciRisiko(sisa0, 'paket');
assert.deepEqual(terkunciPaket, []);
ok('langkah tanpa isian berisiko tidak tertahan');

// Centang membersihkan satu kunci; tombol langkah baru bisa ditekan setelah semuanya bersih.
let sisa = E.sisaSetelahDicentang(sisa0, 'sekolah.kepsek_hp');
sisa = E.sisaSetelahDicentang(sisa, 'sekolah.bendahara_hp');
assert.deepEqual(E.terkunciRisiko(sisa, 'sekolah'), []);
ok('centang membersihkan isian berisiko satu per satu');

// Konfirmasi langkah membersihkan sisa isian BIASA di langkah itu; kunci HP TETAP dituntut
// walau langkahnya sudah dikonfirmasi, sesuai amandemen 2 butir 3 (tombolnya mati selama HP
// belum dicentang, jadi keadaan ini hanya mungkin lewat jalur lain).
const sesudah = E.sisaSetelahDikonfirmasi(sisa0, 'sekolah', ['sekolah.nama', 'sekolah.kepsek_hp', 'sekolah.bendahara_hp']);
assert.deepEqual(sesudah.sort(), ['komponen', 'rombel', 'sekolah.bendahara_hp', 'sekolah.kepsek_hp']);
ok('mengonfirmasi langkah tidak membebaskan centang HP yang belum lengkap');

// Isian "tidak terbaca" yang tidak wajib pun ikut ditagih, bukan cuma yang terisi AI.
const h = { dariScan: ['sekolah.email'], ragu: [], tidakTerbaca: ['sekolah.email'] };
assert.ok(E.wajibDicentang(h).includes('sekolah.email'));
ok('isian tidak terbaca ikut dituntut walau tidak wajib');

// Tinjau terkunci sampai tiga syaratnya lengkap.
assert.equal(E.layakTinjau([], [], []), true);
assert.equal(E.layakTinjau(['rombel'], [], []), false);
assert.equal(E.layakTinjau([], ['catatan'], []), false);
assert.equal(E.layakTinjau([], [], ['SMA']), false);
ok('Tinjau terkunci selama ada sisa, catatan berjenis kosong, atau langkah terkunci');

console.log(`\n${n} pemeriksaan lolos.`);
```

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/konfirmasi-langkah.test.mjs`
Harapan: GAGAL (`terkunciRisiko is not a function`).

- [ ] **Langkah 3: Tambahkan fungsi murninya**

Di `lib/ekstraksi-po.ts`:

```ts
/** Sisa setelah satu isian berisiko dicentang (catatan/17 amandemen 2 butir 2). */
export const sisaSetelahDicentang = (sisa: string[], kunci: string): string[] =>
  sisa.filter((k) => k !== kunci);

/** Isian berisiko di sebuah langkah yang belum dicentang; tombol langkahnya mati selama ini terisi. */
export function terkunciRisiko(sisa: string[], langkah: KodeLangkah): string[] {
  const kunci = KUNCI_LANGKAH.find((l) => l.langkah === langkah)?.kunci ?? [];
  return sisa.filter((k) => kunci.includes(k) && (HP_KEYS as readonly string[]).includes(k));
}

/**
 * Sisa setelah sebuah langkah dikonfirmasi. Isian berisiko yang belum dicentang TETAP tinggal:
 * mengonfirmasi langkah bukan menggantikan centangnya (amandemen 2 butir 2 dan 3).
 */
export function sisaSetelahDikonfirmasi(
  sisa: string[], langkah: KodeLangkah, kunciLangkah: string[],
): string[] {
  return sisa.filter((k) => !(
    kunciLangkah.includes(k) && !(HP_KEYS as readonly string[]).includes(k)
  ));
}

/**
 * Tinjau hanya boleh dibuka bila tidak ada sisa konfirmasi, setiap catatan berjenis, dan tidak
 * ada langkah yang masih terkunci (amandemen 2 butir 4).
 */
export function layakTinjau(
  sisa: string[], catatanTanpaJenis: string[], langkahTerkunci: KodeLangkah[],
): boolean {
  return sisa.length === 0 && catatanTanpaJenis.length === 0 && langkahTerkunci.length === 0;
}
```

> **Penting.** `terkunciRisiko` sengaja hanya menuntut `HP_KEYS` di tingkat PERAMBAN; isian yang
> ditandai ragu juga masuk `sisa`, tetapi tuntutan centang untuk isian ragu sudah tertutup karena
> **mengubah isinya juga terhitung memeriksa** (amandemen 2 butir 2). Perilaku mengubah-isian
> membersihkan `sisa` ada di Langkah 5, bukan di fungsi murni ini.

- [ ] **Langkah 4: Jalankan uji**

Jalankan: `node --test uji/konfirmasi-langkah.test.mjs && npm run periksa`
Harapan: LULUS.

- [ ] **Langkah 5: Sambungkan ke hook**

`use-form-po.ts`:

```ts
const [sisa, setSisa] = useState<string[]>(awal?.ekstraksiMenunggu ?? []);
const [dikonfirmasi, setDikonfirmasi] = useState<Set<KodeLangkah>>(new Set());

/** Mengubah isian yang datang dari scan = memeriksanya (amandemen 2 butir 6). */
function bersihkan(kunci: string) {
  setSisa((s) => sisaSetelahDicentang(s, kunci));
}
```

`konfirmasiLangkah(k)` memanggil `setSisa((s) => sisaSetelahDikonfirmasi(s, k, kunciLangkah(k)))`
lalu menambahkan `k` ke `dikonfirmasi`. Setiap isian dari scan yang berubah memanggil
`bersihkan(kunci)` dari `onChange`-nya; nomor HP **selalu** tetap menuntut centang, jadi
`bersihkan` untuk `HP_KEYS` hanya dijalankan oleh centang, bukan oleh perubahan isian.

Teruskan ke `simpan()`: `ekstraksiMenunggu: sisa.length ? sisa : undefined`, supaya statusnya
ikut tersimpan dan tidak menuntut ulang sesudah draf dibuka lagi.

- [ ] **Langkah 6: Komponen penanda di layar**

`konfirmasi-langkah.tsx`: satu komponen yang dipakai setiap langkah:

```tsx
'use client';
/**
 * Penanda "dari scan, periksa" dan tombol konfirmasi langkah (catatan/17 amandemen 2).
 * Dipakai kelima langkah; langkah tanpa isian dari scan tidak memanggilnya sama sekali.
 */
import type { KodeLangkah } from '@/lib/langkah-po';
import type { PropsLangkah } from './use-form-po';

export default function KonfirmasiLangkah({ f, langkah, label }: {
  f: PropsLangkah['f']; langkah: KodeLangkah; label: string;
}) {
  if (!f.ekstraksi) return null;
  const kunci = f.kunciLangkah(langkah);
  if (!kunci.length) return null;
  const terkunci = f.terkunciRisiko(langkah);
  const sudah = f.sudahDikonfirmasi(langkah);

  return (
    <div className="kotak" style={{ padding: '12px 16px', marginTop: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {kunci.length} isian di langkah ini datang dari hasil baca scan. Periksa terhadap pindaiannya.
      </p>
      {terkunci.length > 0 && (
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Centang dulu isian berisiko: {terkunci.join(', ')}
        </p>
      )}
      <button className="tombol" type="button" disabled={terkunci.length > 0 || sudah}
        onClick={() => f.konfirmasiLangkah(langkah)}>
        {sudah ? `Langkah ${label} sudah dicocokkan` : `Saya sudah mencocokkan isian langkah ${label} dengan scan`}
      </button>
    </div>
  );
}
```

Letakkan `<KonfirmasiLangkah f={f} langkah="sekolah" label="Sekolah" />` di ujung masing-masing
komponen langkah, dan tambahkan centang per isian berisiko di samping isiannya:

```tsx
{f.ekstraksi && f.sisa.includes('sekolah.kepsek_hp') && (
  <label className="baris">
    <input type="checkbox" checked={false} onChange={() => f.centang('sekolah.kepsek_hp')} />
    <span className="meta">Nomor HP kepala sekolah sudah saya cocokkan dengan kertasnya</span>
  </label>
)}
```

Di `langkah/tinjau.tsx`, ganti syarat tombol ajukan/simpan menjadi `layakTinjau(f.sisa,
f.catatanTanpaJenis, f.langkahTerkunci)`; pernyataan "data ini sesuai dengan pindaian" tetap
gerbang terakhir dan tidak berubah.

- [ ] **Langkah 7: Uji dan periksa**

Jalankan: `npm run periksa`
Harapan: LULUS. Lalu pratinjau dua tema di 1200 dan 375 untuk: tanda "dari scan, periksa", tanda
ragu, centang HP, dan catatan paket di langkah 2.

- [ ] **Langkah 8: Commit**

```bash
git add app/\(sistem\)/po/baru/konfirmasi-langkah.tsx app/\(sistem\)/po/baru/langkah \
        app/\(sistem\)/po/baru/use-form-po.ts app/\(sistem\)/po/baru/isian.tsx \
        lib/ekstraksi-po.ts uji/konfirmasi-langkah.test.mjs
git commit -m "Ekstraksi: konfirmasi per langkah dan centang isian berisiko (catatan/25 Tugas 8)"
```

---

### Tugas 9: Halaman Super Admin `/ekstraksi`

**Berkas:**
- Buat: `app/(sistem)/ekstraksi/page.tsx`
- Buat: `app/(sistem)/ekstraksi/gerbang.tsx`
- Buat: `lib/ekstraksi-gerbang-aksi.ts`
- Ubah: `app/(sistem)/menu.tsx`
- Uji: `uji/ekspor-tabel.test.mjs` (perluas, bila ada daftar rute yang dijaga)

**Antarmuka:**
- Mengonsumsi: `pengaturan_ekstraksi` dan `ekstraksi_po` (Tugas 1 dan 2).
- Menghasilkan: `simpanGerbang(isian: { menyala: boolean; penyedia: string; paketAkun: string;
  model: string; pemeriksaanData: string; risikoDiterimaOleh: string; alasanRisiko: string }):
  Promise<{ ok: boolean; galat?: string }>`

- [ ] **Langkah 1: Periksa penyaring menu yang ada**

Baca `app/(sistem)/menu.tsx` dan `app/(sistem)/halaman-nav.tsx`: menu disaring per peran. Tambahkan
butir `{ href: '/ekstraksi', label: 'Ekstraksi', peran: ['admin_utama'] }` mengikuti bentuk yang
sudah dipakai, bukan bentuk baru.

- [ ] **Langkah 2: Server Action gerbang**

`lib/ekstraksi-gerbang-aksi.ts`:

```ts
'use server';
/**
 * Menulis keadaan gerbang ekstraksi (catatan/17). Riwayat tidak pernah disunting: setiap
 * perubahan adalah BARIS BARU, dan baris terakhir yang berlaku. Basis data menolak menyalakan
 * gerbang tanpa penerima risiko dan alasan; aksi ini hanya meneruskan, tidak menggantikan.
 */
import { supabaseServer, penggunaSaatIni, adalahSuperAdmin } from './supabase-server';

export type IsianGerbang = {
  menyala: boolean; penyedia: string; paketAkun: string; model: string;
  pemeriksaanData: string; risikoDiterimaOleh: string; alasanRisiko: string;
};

export async function simpanGerbang(i: IsianGerbang): Promise<{ ok: boolean; galat?: string }> {
  // penggunaSaatIni, bukan penggunaHalaman: aksi server membalas pesan di tempat dan TIDAK
  // melempar, supaya isian formulir yang belum tersimpan tidak hilang (catatan/12).
  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };
  if (!adalahSuperAdmin(sesi.pengguna.peran)) {
    return { ok: false, galat: 'Hanya Super Admin yang boleh mengubah gerbang ini.' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.from('pengaturan_ekstraksi').insert({
    menyala: i.menyala,
    penyedia: i.penyedia.trim() || null,
    paket_akun: i.paketAkun.trim() || null,
    model: i.model.trim() || null,
    pemeriksaan_data: i.pemeriksaanData.trim() || null,
    risiko_diterima_oleh: i.risikoDiterimaOleh.trim() || null,
    alasan_risiko: i.alasanRisiko.trim() || null,
    // Dijawab dari SESI, bukan dari isian: RLS menuntut nilainya sama dengan email pemanggil.
    diubah_oleh: sesi.pengguna.email.toLowerCase(),
  });
  if (error) return { ok: false, galat: error.message };
  return { ok: true };
}
```

- [ ] **Langkah 3: Halaman dan formulirnya**

`app/(sistem)/ekstraksi/page.tsx` (Server Component): gerbang baca `penggunaHalaman()` lalu
`redirect('/beranda')` bila bukan `admin_utama`. Baca:

1. baris terakhir `pengaturan_ekstraksi` (`order('id', { ascending: false }).limit(1)`) — keadaan berlaku;
2. seluruh riwayatnya (dibatasi 20 terakhir) — tabel;
3. `ekstraksi_po` terbaru beserta `po(nomor, sekolah(nama))`, dibatasi 50, kolom
   `po_id, diklaim_oleh, diklaim_pada, selesai_pada, durasi_ms, berhasil, token_masuk, token_keluar`.
   **`hasil` TIDAK ikut di daftar**; ia dibuka lewat tombol yang memanggil Server Action terpisah,
   supaya hasil mentah tidak terkirim ke peramban tanpa diminta.

Sertakan peringatan tetap di atas daftar:

```
Hasil mentah di halaman ini memuat data pribadi dari pindaian: nama kepala sekolah dan bendahara
beserta nomor HP-nya. Tampilkan hanya saat perlu.
```

- [ ] **Langkah 4: Jalankan gerbang dan periksa**

Jalankan: `npm run periksa && npm run build`
Harapan: LULUS, `pindai-bundel` melaporkan chunk bersih.

- [ ] **Langkah 5: Buktikan halaman tertutup tanpa peran**

Jalankan server lokal, lalu dari akun non-Super Admin pastikan `/ekstraksi` mengalihkan ke
`/beranda`, dan panggilan langsung ke `simpanGerbang` dari peramban ditolak. Ini pemeriksaan
KEAMANAN wajib, bukan pelengkap.

- [ ] **Langkah 6: Commit**

```bash
git add app/\(sistem\)/ekstraksi app/\(sistem\)/menu.tsx lib/ekstraksi-gerbang-aksi.ts
git commit -m "Ekstraksi: gerbang dan daftar pembacaan untuk Super Admin (catatan/25 Tugas 9)"
```

---

### Tugas 10: Lencana dan lini masa `dibaca_ai_pada`

**Berkas:**
- Ubah: `lib/lini-masa.ts` (`SumberLiniMasa`, `kunciPeristiwa`, `liniMasa`)
- Ubah: `app/(sistem)/po/[id]/page.tsx` (baca kolom, lencana kepala halaman)
- Ubah: `app/(sistem)/sekolah/[id]/page.tsx` (teruskan kolom ke lini masa)
- Ubah: `app/(sistem)/verifikasi/page.tsx` (lencana di antrean otomatis)
- Uji: `uji/lini-masa.test.mjs` (tambahkan kasing)

**Antarmuka:**
- Mengonsumsi: `po.dibaca_ai_pada` (Tugas 1).
- Menghasilkan: `kunciPeristiwa.ekstraksi(waktu: string): string` dan
  `SumberLiniMasa.dibacaAiPada?: string | null`.

- [ ] **Langkah 1: Tulis uji yang gagal**

Tambahkan ke `uji/lini-masa.test.mjs` (pakai `muat('lini-masa')` seperti berkas itu memuatnya;
jangan mengarang alias impor baru):

```js
// Penanda "dibaca AI" muncul di lini masa sebagai peristiwa biasa, dan bisa dibalas seperti
// peristiwa lain (catatan/17 amandemen 1).
const dgn = muat('lini-masa').liniMasa({ riwayat: [], dibacaAiPada: '2026-09-26T03:00:00Z' });
const ev = dgn.find((e) => e.kunci.startsWith('ekstraksi:'));
assert.ok(ev, 'peristiwa isian awal dari AI tidak muncul');
assert.equal(ev.waktu, '2026-09-26T03:00:00Z');
assert.equal(ev.judul, 'Isian awal dibaca AI');
assert.ok(ev.kunci.endsWith('2026-09-26T03:00:00Z'), 'kunci selain komentar wajib berakhiran waktu');
ok('peristiwa isian awal AI tampil dan berkunci berakhiran waktu');

assert.deepEqual(
  muat('lini-masa').liniMasa({ riwayat: [] }).filter((e) => e.kunci.startsWith('ekstraksi:')), []);
ok('PO tanpa penanda tidak memunculkan peristiwa apa pun');
```

> **Kalau berkas itu sudah menyimpan hasil `muat('lini-masa')` di sebuah variabel**, pakai variabel
> itu alih-alih memanggil `muat` lagi: `muat` sudah menyimpan singgahan, jadi keduanya menunjuk
> modul yang sama, tetapi satu gaya per berkas lebih mudah dibaca.

- [ ] **Langkah 2: Jalankan, pastikan gagal**

Jalankan: `node --test uji/lini-masa.test.mjs`
Harapan: GAGAL (`peristiwa isian awal dari AI tidak muncul`).

- [ ] **Langkah 3: Implementasi**

Di `lib/lini-masa.ts`:

```ts
// kunciPeristiwa, tambahkan satu baris — kuncinya WAJIB berakhiran waktu peristiwanya, atau
// tanda tangan/isian yang dibubuhkan ulang mewarisi balasan lama diam-diam (catatan/20).
ekstraksi: (waktu: string) => `ekstraksi:${waktu}`,
```

Di `SumberLiniMasa`, tambahkan:

```ts
/** po.dibaca_ai_pada: isian awal PO ini dibaca AI dari pindaian (catatan/17). */
dibacaAiPada?: string | null;
```

Di `liniMasa()`, sesudah loop `riwayat`:

```ts
// Isian awal dari AI adalah peristiwa PO, bukan keputusan sesiapa: yang perlu terbaca adalah
// KAPAN isiannya datang dari mesin, supaya HoO dan Tech Ops Lead bisa memeriksa acak sesudahnya.
if (s.dibacaAiPada) {
  p.push({
    kunci: kunciPeristiwa.ekstraksi(s.dibacaAiPada),
    balasan: [],
    waktu: s.dibacaAiPada, warna: 'draf',
    judul: 'Isian awal dibaca AI',
    rincian: 'Diperiksa dan dikonfirmasi Sales terhadap pindaiannya',
    oleh: s.riwayat?.[0]?.oleh ?? null,
  });
}
```

Di `app/(sistem)/po/[id]/page.tsx`: tambahkan `dibaca_ai_pada` ke daftar kolom yang dibaca, teruskan
`dibacaAiPada: po.dibaca_ai_pada` ke `SumberLiniMasa`, dan tambahkan lencana di kepala halaman
sebelah lencana "lolos otomatis":

```tsx
{po.dibaca_ai_pada && <span className="lencana">dibaca AI</span>}
```

Di `app/(sistem)/sekolah/[id]/page.tsx`: tambahkan `dibaca_ai_pada` ke daftar kolom dan teruskan
sama. Di `app/(sistem)/verifikasi/page.tsx`: tambahkan `dibaca_ai_pada` ke `select` antrean
otomatis dan tampilkan lencana yang sama di samping "lolos otomatis".

- [ ] **Langkah 4: Jalankan gerbang dan pratinjau**

Jalankan: `node --test uji/lini-masa.test.mjs && npm run periksa`
Harapan: LULUS. Pratinjau lencananya di dua tema, dua lebar, lewat pola pratinjau yang sudah ada.

- [ ] **Langkah 5: Commit**

```bash
git add lib/lini-masa.ts app/\(sistem\)/po/\[id\]/page.tsx \
        app/\(sistem\)/sekolah/\[id\]/page.tsx app/\(sistem\)/verifikasi/page.tsx \
        uji/lini-masa.test.mjs
git commit -m "Ekstraksi: penanda dibaca AI di lini masa, antrean verifikasi, dan halaman PO (catatan/25 Tugas 10)"
```

---

### Tugas 11: Penyaring akhir dan QA independen

**Berkas:**
- Ubah: `catatan/17-spesifikasi-ekstraksi-scan-po.md` (status jadi DIBANGUN)
- Ubah: `HANDOFF.md`

- [ ] **Langkah 1: Gerbang penuh**

```bash
npm run periksa
npm run build          # postbuild menjalankan pindai-bundel, termasuk kunci penyedia
```

Harapan: keduanya exit 0; `pindai-bundel` melaporkan bersih dari angka Acquisition DAN dari nama
kunci penyedia.

- [ ] **Langkah 2: Bukti basis data penuh**

```bash
uji/db-lokal/jalankan-bukti-ekstraksi.sh
```

Harapan: P1-P6 dan P9 bersih.

- [ ] **Langkah 3: QA independen**

Dispatch sub-agen dengan aturan yang sudah dipakai proyek ini:

- catat `git rev-parse HEAD` dan `git status --porcelain` SEBELUM mulai, bandingkan SESUDAHNYA;
- **larang menulis** (spesifikasi eksplisit);
- minta temuan dengan angka dan rujukan baris. Untuk temuan TATA LETAK, tuntut
  `scrollWidth`/`clientWidth`, bukan penilaian: QA pernah menandai luberan 307px sebagai
  "disengaja" karena membaca komentar.

Fokus yang diminta diperiksa, dan tidak boleh dilewat:

1. jalur unggah tanpa gerbang berperilaku persis seperti sebelumnya (bandingkan kiriman `IsiPo`);
2. gerbang mati menolak klaim, dan kotak "Baca scan" tidak tampil;
3. gagal baca tidak meninggalkan draf, berkas, atau penanda;
4. `dibaca_ai_pada` tidak bisa dipalsukan, dikosongkan, atau diubah sesudah diteken;
5. konfirmasi per langkah tidak bisa dilewati satu klik, dan nomor HP selalu dituntut;
6. hasil baca AI tidak pernah mengisi jenis catatan maupun nilai sponsorship;
7. harga Acquisition tidak bocor lewat modul baru.

- [ ] **Langkah 4: Perbaiki temuan, ulangi gerbang**

Setiap temuan diperbaiki atau dijawab dengan bukti. Kalau perbaikannya mengubah aturan, ubah uji
penjaganya lebih dulu.

- [ ] **Langkah 5: Perbarui catatan dan serahkan**

Ubah status `catatan/17` menjadi **DIBANGUN (belum tayang)**, tulis hasil QA di `HANDOFF.md`
bagian "In progress", dan tulis daftar yang masih tertahan: tiga syarat "Sebelum gerbang
dinyalakan" (Tugas 12) belum selesai.

- [ ] **Langkah 6: Commit**

```bash
git add catatan/17-spesifikasi-ekstraksi-scan-po.md HANDOFF.md
git commit -m "Ekstraksi: penyaring akhir dan hasil QA independen (catatan/25 Tugas 11)"
```

---

### Tugas 12: Rilis ke produksi (HANYA dengan persetujuan eksplisit Rizki)

**Berkas:**
- Ubah: `catatan/17-spesifikasi-ekstraksi-scan-po.md` (status jadi TAYANG)

- [ ] **Langkah 1: Minta persetujuan Rizki**

Tunjukkan: hasil QA, `git log --oneline main..build/ekstraksi-scan-po`, ketiga berkas migrasi, dan
keadaan tiga syarat "Sebelum gerbang dinyalakan". Jangan lanjut tanpa jawaban eksplisit.

- [ ] **Langkah 2: Rizki menerapkan migrasi**

Rizki menjalankan `supabase db push` **dari direktori proyek** (dari `~` gagal dengan "Cannot find
project ref", dan pengklasifikasi izin agen menolak perintah ini). Sesudah itu periksa paritas:
ketiga berkas ada di rantai dan `supabase migration list` melaporkan lokal = awan.

- [ ] **Langkah 3: Deploy produksi**

```bash
vercel --prod --yes
```

Vercel TIDAK tersambung git: `git push` tidak men-deploy apa pun.

- [ ] **Langkah 4: Tambahkan kunci penyedia di Vercel**

Pasang `OPENCODE_GO_API_KEY` di environment produksi dan preview, oleh Rizki. Tanpa itu, kotak
"Baca scan" tampil tetapi tekanannya gagal dengan "Kunci penyedia ekstraksi belum dipasang di
server."; jalur ketik tetap normal.

- [ ] **Langkah 5: Uji asap di produksi**

`/beranda` mengalihkan ke `/masuk` (307) tanpa sesi, dan `/ekstraksi` juga. Lalu dengan akun
Sales: buat PO unggahan dengan centang AI, baca scan PO rekaan, dan pastikan PO-nya berstatus
draf dengan `dibaca_ai_pada` terisi.

- [ ] **Langkah 6: Gerbang organisasi TETAP MATI**

Menyalakan gerbang adalah keputusan Rizki, sesudah tiga syarat ini selesai (catatan/17 "Sebelum
gerbang dinyalakan", tidak menahan pembangunan):

1. syarat pemakaian OpenCode Go diperiksa untuk aplikasi produksi;
2. tim mengisi 5 sampai 10 Form PO rekaan tulisan tangan dari penulis berbeda dan akurasinya
   diukur dengan skrip uji yang sama;
3. kalimat pemberitahuan (`catatan/10`) dikirim ke legal.

- [ ] **Langkah 7: Gabungkan dan tutup**

```bash
git checkout main && git merge --no-ff build/ekstraksi-scan-po
git push origin main
```

Perbarui `HANDOFF.md`, `catatan/17` (status TAYANG), dan catat pelajarannya di
`ObsidianVault/Brain/skolla-kerjasama-sistem.md`.

---

## Tinjauan mandiri (dijalankan saat menulis rencana)

**Cakupan spesifikasi.** Setiap bagian `catatan/17` sudah punya tugas:

| Bagian spesifikasi | Tugas |
|---|---|
| Alur (amandemen 3: baca dulu, simpan sesudahnya) | 6 (langkah 0), 7 (tautan sesudah simpan) |
| Pemetaan ke wizard, kotak paket | 3 |
| Aturan pengisian 1-8 | 3 (1, 4, 6, 8), 8 (2, 3, 4, 5, 7) |
| Amandemen 1: penanda `dibaca_ai_pada` + tiga tempat tampil | 1, 10 |
| Amandemen 2: konfirmasi per langkah + centang berisiko + status tersimpan | 7 (kolom), 8 (perilaku) |
| Amandemen 3: tiga fungsi, batas 20 klaim, pembersihan 24 jam | 2 |
| Data: `pengaturan_ekstraksi`, `ekstraksi_po` | 1, 2 |
| Data: masa simpan mengikuti pindaian PO, ikut terhapus bersama PO | 2 (komentar tabel + `on delete cascade`) |
| Perlindungan 1-5 | 2 (1, 2, 3), 4 (4), 5 (4, 5) |
| Kegagalan: batas waktu, tanpa coba ulang, bidang dibuang satu per satu | 4 (batas waktu), 5 (pesan), 3 (bidang) |
| Uji 1-5 | 3 (1), 8 (2), 1 dan 2 (3), 6 dan 8 (4), 11 (5) |
| Halaman Super Admin | 9 |
| Sebelum gerbang dinyalakan | 12 |
| Penyaring `pindai-bundel` diperluas | 5 |

**Tidak ada placeholder.** Setiap langkah berisi kode atau perintah yang bisa dijalankan. Dua
tempat sengaja menyerahkan bentuk akhirnya ke pelaksana, dan keduanya disebut alasannya:
probe P9 di Tugas 1 (memakai `bukti-sidik.sql` catat/banding yang sudah ada, bukan cara kedua),
dan penyesuaian bentuk menu di Tugas 9 (mengikuti penyaring menu yang sudah ada).

**Diperiksa ulang saat menulis rencana, dan diperbaiki:** bentuk helper sesi salah (`supabaseServer()`
mengembalikan klien LANGSUNG, bukan `{ sb, pengguna }`; super admin lewat `adalahSuperAdmin(peran)`);
`catatan` dipindah ke tingkat atas `HasilPetakan` supaya kunci di `KUNCI_LANGKAH` dan di uji
menunjuk hal yang sama; satuan `jenjang` di uji diperbaiki (ia ada DI DALAM `sekolah`, bukan di
tingkat atas, dan nilai tak sah menghasilkan `undefined`, bukan `'SMA'`); ekspektasi
`sisaSetelahDikonfirmasi` diperbaiki (kunci HP memang TETAP tinggal); `maxDuration = 90` ditambahkan
di halaman yang memicu aksi, bukan di berkas aksi; `private.model_ekstraksi()` disatukan ke dalam
migrasi Tugas 2 alih-alih menggantung di catatan.

**Konsistensi tipe.** Nama yang dipakai berulang sudah sama di semua tugas:
`HasilPetakan`, `petakanEkstraksi`, `wajibDicentang`, `langkahIsian`, `terkunciRisiko`,
`sisaSetelahDikonfirmasi`, `layakTinjau`; RPC `klaim_ekstraksi()`, `selesai_ekstraksi(...)`,
`tautkan_ekstraksi(id, po)`; kolom `po.dibaca_ai_pada`, `po.ekstraksi_menunggu`; aksi
`bacaScanPo`, `tautkanEkstraksi`; kunci peristiwa `ekstraksi:<waktu>`.

**Risiko yang tercatat, bukan disembunyikan.**

1. Rendering PDF di peramban membuat gambar yang dikirim bisa berbeda dari PDF tersimpan. Diterima
   spesifikasi: hasilnya hanya isian awal yang wajib dikonfirmasi Sales terhadap scan tersimpan.
2. Sales yang sengaja memanggil `selesai_ekstraksi` lewat API bisa mengganti catatan pembacaannya
   sendiri satu kali dalam 5 menit. Yang terkena hanya salinan audit. Menutupnya berarti menambah
   kunci service role ke Vercel, kuasa yang terlalu luas untuk ini. Diterima.
3. Penyedia tanpa DPA, dan paket OpenCode Go dijual untuk agen koding. Gerbang dibuat supaya
   mematikannya cukup satu baris, dan tiga syarat sebelum menyalakannya belum selesai.
