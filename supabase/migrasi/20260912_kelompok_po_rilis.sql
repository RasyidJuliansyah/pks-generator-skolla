-- Rilis kelompok PO (spesifikasi 07, langkah 4–5): satu migrasi, SENGAJA tidak dicicil.
--
-- Membuka po_kelompok setengah jalan membuat jalan pintas lantai harga (catatan/07,
-- "Langkah 3"): bila trigger membaca harga dari po_kelompok "kalau barisnya ada", Sales
-- bisa menyisipkan po_kelompok(1, harga tinggi) lewat PostgREST lalu menurunkan
-- po.harga_siswa di bawah lantai. Maka seluruh aturannya masuk di sini sekaligus, dan
-- kunci `*_kelompok_satu_dulu` (20260910m) dilepas di migrasi yang sama.
--
-- BENTUK YANG SAH, diperiksa trigger saat PO meninggalkan draf:
--
--   * SATU KELOMPOK = NOL baris po_kelompok. Seluruh PO lama dan PO satu kelompok baru
--     tetap persis seperti kemarin: harga di po.harga_siswa, semua rombel dan komponen di
--     kelompok 1. Kode lama pun tetap benar terhadap migrasi ini.
--   * BANYAK KELOMPOK = DUA baris atau lebih. Harga per kelompok tinggal di po_kelompok;
--     po.harga_siswa WAJIB 0 supaya tidak ada angka kedua yang bisa dipakai menipu;
--     jumlah_siswa = jumlah rombel seluruh kelompok; grand_total = Σ harga × siswa
--     kelompok + guru. Tiap kelompok berisi siswa, punya komponen, dan tidak di bawah
--     lantainya sendiri.
--   * TEPAT SATU baris ditolak — itulah bentuk jalan pintasnya.
--   * PO UNGGAHAN tetap satu kelompok: kertas Form PO lama hanya punya satu baris
--     "Siswa". Dengan begitu gerbang pengecualian (khusus unggahan) tidak perlu diperluas,
--     dan ia menolak PO berkelompok untuk berjaga-jaga.
--   * PELATIHAN GURU di tingkat PO: komponen guru selalu di kelompok 1.
--
-- SEKALIAN MENUTUP LUBANG LAMA sekelas: sampai hari ini tidak ada yang mencocokkan
-- grand_total dengan harga × jumlah, padahal grand_total yang dicetak di PKS dan jadi
-- patokan termin. Pemilik PO bisa menulis harga di atas lantai dan grand_total sekecil
-- apa pun lewat PostgREST. Kini dicocokkan di kedua jalur. Diperiksa 12 Sep 2026: kedua
-- PO yang ada konsisten, jadi tidak ada yang macet karenanya.
--
-- Diterapkan TEPAT sebelum deploy kode yang memakainya: bila kunci terbuka sementara kode
-- lama tayang, PO berkelompok rakitan PostgREST lolos semua aturan di sini tetapi dicetak
-- kode lama sebagai satu baris "Siswa" berharga 0.

create table if not exists po_kelompok (
  po_id       uuid     not null references po(id) on delete cascade,
  nomor       smallint not null check (nomor between 1 and 6),
  nama        text     check (nama is null or length(btrim(nama)) between 1 and 60),
  harga_siswa bigint   not null check (harga_siswa >= 0),
  primary key (po_id, nomor)
);
alter table po_kelompok enable row level security;

-- Sama persis dengan tabel anak lain: terlihat bila PO-nya terlihat, bisa ditulis selama
-- boleh_ubah_po — jadi ikut membeku begitu PO meninggalkan draf.
drop policy if exists po_kelompok_lihat on po_kelompok;
create policy po_kelompok_lihat on po_kelompok for select to authenticated
using (exists (select 1 from po p where p.id = po_kelompok.po_id
               and private.boleh_lihat_po(p.dibuat_oleh)));

drop policy if exists po_kelompok_tulis on po_kelompok;
create policy po_kelompok_tulis on po_kelompok for all to authenticated
using (exists (select 1 from po p where p.id = po_kelompok.po_id
               and private.boleh_ubah_po(p.dibuat_oleh, p.status)))
with check (exists (select 1 from po p where p.id = po_kelompok.po_id
               and private.boleh_ubah_po(p.dibuat_oleh, p.status)));

revoke all on po_kelompok from anon;
-- Izin bawaan skema memberi authenticated segalanya, termasuk TRUNCATE. RLS tidak berlaku
-- untuk TRUNCATE, jadi yang tidak dibutuhkan dicabut.
revoke truncate, trigger, references on po_kelompok from authenticated;

-- Kunci dilepas; rentangnya mengikuti angkatan terbanyak (SD, enam kelas).
alter table po_rombel   drop constraint if exists po_rombel_kelompok_satu_dulu;
alter table po_komponen drop constraint if exists po_komponen_kelompok_satu_dulu;
alter table po_rombel   drop constraint if exists po_rombel_kelompok_rentang;
alter table po_rombel   add  constraint po_rombel_kelompok_rentang   check (kelompok between 1 and 6);
alter table po_komponen drop constraint if exists po_komponen_kelompok_rentang;
alter table po_komponen add  constraint po_komponen_kelompok_rentang check (kelompok between 1 and 6);
-- Komponen yang sama boleh ada di beberapa kelompok (LMS di kelas 10 dan 12).
alter table po_komponen drop constraint po_komponen_pkey;
alter table po_komponen add  constraint po_komponen_pkey primary key (po_id, kelompok, komponen_id);

/** Lantai per siswa SATU kelompok — aturan private.lantai_siswa, disaring kelompoknya. */
create or replace function private.lantai_siswa_kelompok(p_po uuid, p_kelompok smallint)
returns bigint
language sql
stable
security definer
set search_path to public
as $$
  with k as (
    select pk.sesi, h.id, h.bottom, h.grup, h.untuk_guru
    from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
    where pk.po_id = p_po and pk.kelompok = p_kelompok
  ),
  inti as (
    select coalesce(array_agg(id order by id), array[]::text[]) as ids,
           coalesce(sum(bottom), 0) as jumlah
    from k where grup = 'core' and not untuk_guru
  ),
  addon as (
    select coalesce(sum(bottom * greatest(sesi, 1)), 0) as jumlah
    from k where grup = 'addon' and not untuk_guru
  )
  select coalesce(
           (select hp.bottom from harga_paket hp, inti where hp.ids = inti.ids),
           (select jumlah from inti)
         ) + (select jumlah from addon);
$$;
revoke all on function private.lantai_siswa_kelompok(uuid, smallint) from public, anon, authenticated;

create or replace function private.jaga_lantai_po()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_siswa  bigint;
  v_guru   bigint;
  v_ok     boolean;
  v_n      int;
  v_total  bigint := 0;
  v_jumlah bigint := 0;
  v_s      bigint;
  v_lantai bigint;
  v_label  text;
  r        record;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draf' then
      raise exception 'PO baru harus berstatus draf, bukan %', new.status
        using errcode = 'check_violation';
    end if;
    return new;
  end if;

  if old.status not in ('draf', 'ditolak') then return new; end if;
  if new.status in ('draf', 'ditolak') then return new; end if;

  -- Pelatihan Guru di tingkat PO, bukan kelompok.
  if exists (select 1 from po_komponen pk join harga_komponen h on h.id = pk.komponen_id
             where pk.po_id = new.id and h.untuk_guru and pk.kelompok <> 1) then
    raise exception 'Pelatihan Guru dicatat di tingkat PO (kelompok 1), bukan per kelompok.'
      using errcode = 'check_violation';
  end if;

  select count(*) into v_n from po_kelompok where po_id = new.id;

  if v_n = 1 then
    raise exception 'PO satu kelompok disimpan tanpa baris po_kelompok; harganya di harga siswa PO.'
      using errcode = 'check_violation';
  end if;

  if v_n = 0 then
    -- ---------- satu kelompok: persis seperti sebelum migrasi ini ----------
    if exists (select 1 from po_komponen where po_id = new.id and kelompok <> 1)
       or exists (select 1 from po_rombel where po_id = new.id and kelompok <> 1) then
      raise exception 'Komponen atau rombel menunjuk kelompok yang tidak ada.'
        using errcode = 'check_violation';
    end if;

    v_siswa := private.lantai_siswa(new.id);
    if v_siswa > 0 and new.harga_siswa < v_siswa then
      select exists (
        select 1 from po_pengecualian x
        where x.po_id = new.id
          and x.harga_disetujui  = new.harga_siswa
          and x.lantai_disetujui = v_siswa
      ) into v_ok;
      if not v_ok then
        raise exception 'Harga siswa % di bawah bottom price (% per siswa).',
          new.harga_siswa, v_siswa using errcode = 'check_violation';
      end if;
    end if;

    if new.grand_total is distinct from new.harga_siswa * new.jumlah_siswa + new.harga_guru * new.jumlah_guru then
      raise exception 'Grand total % tidak sama dengan harga × jumlah (%).',
        new.grand_total, new.harga_siswa * new.jumlah_siswa + new.harga_guru * new.jumlah_guru
        using errcode = 'check_violation';
    end if;
  else
    -- ---------- banyak kelompok ----------
    if new.asal <> 'platform' then
      raise exception 'PO unggahan belum bisa berkelompok: kertas Form PO hanya punya satu baris siswa.'
        using errcode = 'check_violation';
    end if;
    if new.harga_siswa <> 0 then
      raise exception 'PO berkelompok menyimpan harga per kelompok; harga siswa PO harus 0, bukan %.',
        new.harga_siswa using errcode = 'check_violation';
    end if;
    if exists (select 1 from po_rombel x where x.po_id = new.id and x.jumlah_siswa > 0
               and not exists (select 1 from po_kelompok k where k.po_id = new.id and k.nomor = x.kelompok)) then
      raise exception 'Ada siswa di rombel yang belum masuk kelompok mana pun, jadi tidak tertagih.'
        using errcode = 'check_violation';
    end if;
    if exists (select 1 from po_komponen x join harga_komponen h on h.id = x.komponen_id
               where x.po_id = new.id and not h.untuk_guru
               and not exists (select 1 from po_kelompok k where k.po_id = new.id and k.nomor = x.kelompok)) then
      raise exception 'Ada komponen yang menunjuk kelompok yang tidak ada.'
        using errcode = 'check_violation';
    end if;

    for r in select k.nomor, k.nama, k.harga_siswa from po_kelompok k
             where k.po_id = new.id order by k.nomor loop
      v_label := coalesce(nullif(btrim(r.nama), ''), 'Kelompok ' || r.nomor);
      select coalesce(sum(jumlah_siswa), 0) into v_s
        from po_rombel where po_id = new.id and kelompok = r.nomor;
      if v_s = 0 then
        raise exception '% belum berisi siswa.', v_label using errcode = 'check_violation';
      end if;
      if not exists (select 1 from po_komponen x join harga_komponen h on h.id = x.komponen_id
                     where x.po_id = new.id and x.kelompok = r.nomor and not h.untuk_guru) then
        raise exception '% belum punya komponen.', v_label using errcode = 'check_violation';
      end if;
      v_lantai := private.lantai_siswa_kelompok(new.id, r.nomor);
      if v_lantai > 0 and r.harga_siswa < v_lantai then
        raise exception 'Harga siswa % (%) di bawah bottom price (% per siswa).',
          v_label, r.harga_siswa, v_lantai using errcode = 'check_violation';
      end if;
      v_jumlah := v_jumlah + v_s;
      v_total  := v_total + r.harga_siswa * v_s;
    end loop;

    if new.jumlah_siswa <> v_jumlah then
      raise exception 'Jumlah siswa PO % tidak sama dengan jumlah rombel seluruh kelompok (%).',
        new.jumlah_siswa, v_jumlah using errcode = 'check_violation';
    end if;
    if new.grand_total is distinct from v_total + new.harga_guru * new.jumlah_guru then
      raise exception 'Grand total % tidak sama dengan jumlah seluruh kelompok ditambah guru (%).',
        new.grand_total, v_total + new.harga_guru * new.jumlah_guru using errcode = 'check_violation';
    end if;
  end if;

  v_guru := private.lantai_guru(new.id);
  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).',
      new.harga_guru, v_guru using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Pengecualian khusus PO unggahan, dan unggahan tidak bisa berkelompok. Ditolak juga di
-- sini supaya persetujuan tidak pernah dibuat atas harga_siswa yang bukan harga PO-nya.
create or replace function private.jaga_pengecualian()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po     po%rowtype;
  v_lantai bigint;
  v_saya   text := lower(auth.jwt() ->> 'email');
begin
  select * into v_po from po where id = new.po_id;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if v_po.asal <> 'unggahan' then
    raise exception 'Pengecualian hanya untuk PO unggahan, bukan PO yang dibuat di platform.'
      using errcode = 'check_violation';
  end if;

  if exists (select 1 from po_kelompok where po_id = new.po_id) then
    raise exception 'Pengecualian hanya untuk PO satu kelompok.' using errcode = 'check_violation';
  end if;

  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Penyetuju tidak boleh orang yang sama dengan pembuat PO.'
      using errcode = 'check_violation';
  end if;

  new.disetujui_oleh := v_saya;

  v_lantai := private.lantai_siswa(new.po_id);
  new.lantai_disetujui := v_lantai;
  new.harga_disetujui  := v_po.harga_siswa;

  if v_po.harga_siswa >= v_lantai then
    raise exception 'PO ini tidak melanggar lantai (harga % >= lantai %). Tidak perlu pengecualian.',
      v_po.harga_siswa, v_lantai using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- Sidik tinjauan PO unggahan ikut menyidik po_kelompok. Unggahan memang tidak bisa
-- berkelompok, tapi baris yang disisipkan sesudah pernyataan tetap harus membatalkannya.
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
                               'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik']),
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
