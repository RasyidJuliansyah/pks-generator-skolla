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

-- 2b. Keadaan gerbang untuk LAYAR. Sales tidak boleh membaca tabelnya (isinya penerima risiko
--     dan alasannya, urusan kepatuhan organisasi), tetapi halaman Form PO harus tahu apakah kotak
--     "Baca scan" pantas ditampilkan -- dan halaman itu jalan dengan sesi Sales. Fungsi ini
--     mengembalikan SATU bit, tanpa satu pun kolom lain. (Tanpa ini, `menyala` selalu terbaca
--     false bagi Sales, kotaknya tidak pernah muncul, dan fiturnya mati bagi satu-satunya orang
--     yang memakainya.)
create or replace function public.gerbang_ekstraksi_menyala()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce((select menyala from pengaturan_ekstraksi order by id desc limit 1), false) $$;

revoke all on function public.gerbang_ekstraksi_menyala() from public, anon;
grant execute on function public.gerbang_ekstraksi_menyala() to authenticated;

-- 3. Nama model dipaku di basis data, bukan diterima dari klien: setiap baris pembacaan mencatat
--    model yang benar-benar dipakai, dan klien tidak punya suara soal itu.
create or replace function private.model_ekstraksi()
returns text language sql immutable set search_path = public
as $$ select 'deepseek-v4.1-flash'::text $$;
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
--    yang sudah diteken. Ditulis di atas versi 20260925b.
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
