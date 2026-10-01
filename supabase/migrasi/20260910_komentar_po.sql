-- Langkah 1 dari catatan/09-spesifikasi-komentar-po.md: skema, RLS, dan penjaganya.
--
-- Komentar TIDAK menggantikan `verifikasi.catatan`. "Kenapa saya memutuskan begini"
-- sudah tercatat per fungsi di sana, berikut pembasiannya. Yang belum ada adalah
-- percakapan dua arah: Sales tidak bisa membalas, dan verifikator tidak bisa berdiskusi
-- satu sama lain. Celah itu yang diisi di sini.
--
-- Langkah ini sengaja tidak mengubah apa pun yang terlihat. Tidak ada layar baru, tidak
-- ada tombol; hanya tabelnya, aturan siapa boleh apa, dan uji yang membuktikannya.

create table if not exists po_komentar (
  id             uuid primary key default gen_random_uuid(),
  po_id          uuid not null references po(id) on delete cascade,
  isi            text not null check (length(btrim(isi)) > 0),
  oleh           text not null,
  waktu          timestamptz not null default now(),
  -- Salinan `po.versi` saat komentar ditulis, supaya "harga termin kedua kurang" tidak
  -- terbaca menyesatkan setelah terminnya diperbaiki. Meniru cara `verifikasi` menjadi
  -- basi lewat versi, bukan mekanisme baru.
  versi_po       integer not null,
  disunting_pada timestamptz,
  -- Ditandai, isinya TIDAK hilang. Komentar yang dihapus tetap menempati tempatnya di
  -- lini masa; yang berubah hanya apa yang ditampilkan.
  dihapus_pada   timestamptz,
  dihapus_oleh   text
);

create index if not exists po_komentar_po_waktu on po_komentar (po_id, waktu);

-- Versi lama tidak pernah hilang, sama seperti keputusan verifikasi yang digantikan
-- bukan ditimpa.
create table if not exists po_komentar_revisi (
  komentar_id     uuid not null references po_komentar(id) on delete cascade,
  isi             text not null,
  digantikan_pada timestamptz not null default now()
);

create index if not exists po_komentar_revisi_induk on po_komentar_revisi (komentar_id);

-- Penanda baca, untuk lencana di langkah 3. Ditaruh sekarang supaya seluruh skema
-- komentar berdiri sekali jalan, bukan dua migrasi yang menyentuh hal yang sama.
create table if not exists po_komentar_dibaca (
  po_id  uuid not null references po(id) on delete cascade,
  oleh   text not null,
  waktu  timestamptz not null default now(),
  primary key (po_id, oleh)
);

alter table po_komentar        enable row level security;
alter table po_komentar_revisi enable row level security;
alter table po_komentar_dibaca enable row level security;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- SELECT mengikuti visibilitas PO-nya, tanpa aturan kedua. Komentar tidak boleh jadi
-- jalan memutar untuk melihat PO orang lain: Sales polos hanya melihat komentar di PO
-- miliknya, karena `po` sendiri hanya menampilkan PO miliknya kepada dia.
drop policy if exists komentar_lihat on po_komentar;
create policy komentar_lihat on po_komentar for select to authenticated
using (exists (select 1 from po p
               where p.id = po_komentar.po_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

-- INSERT: visibilitas yang sama, bukan pemegang c_level, dan atas nama diri sendiri.
--
-- `private.punya_peran('c_level')` TIDAK dipakai di sini — fungsi itu bernilai true
-- untuk siapa pun yang memegang `admin_utama`, jadi menegasikannya justru mengunci
-- Super Admin dan meloloskan orangnya salah. Yang dibutuhkan pemeriksaan harfiah:
-- apakah 'c_level' benar-benar ada di dalam array perannya.
drop policy if exists komentar_tulis on po_komentar;
create policy komentar_tulis on po_komentar for insert to authenticated
with check (
  exists (select 1 from po p
          where p.id = po_komentar.po_id
            and private.boleh_lihat_po(p.dibuat_oleh))
  and not ('c_level' = any (private.peran_saya()))
  and oleh = lower(auth.jwt() ->> 'email')
);

-- Tidak ada kebijakan UPDATE maupun DELETE.
--
-- Menyunting lewat `sunting_komentar()`, menghapus lewat `hapus_komentar()`. Keduanya
-- melewati RLS dengan `security definer` dan memeriksa kepemilikan sendiri. Menyunting
-- langsung dari klien berarti bisa mengganti isi tanpa meninggalkan revisi — persis
-- yang tidak boleh terjadi.
revoke update, delete on po_komentar from anon, authenticated;

-- Revisi hanya ditulis trigger. Klien membacanya, tidak pernah mengarangnya.
drop policy if exists komentar_revisi_lihat on po_komentar_revisi;
create policy komentar_revisi_lihat on po_komentar_revisi for select to authenticated
using (exists (select 1 from po_komentar k
               join po p on p.id = k.po_id
               where k.id = po_komentar_revisi.komentar_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

revoke insert, update, delete on po_komentar_revisi from anon, authenticated;

-- Penanda baca milik masing-masing orang; tidak ada yang perlu melihat kapan orang lain
-- membaca, dan menyimpannya begitu saja membuatnya jadi data pengawasan.
drop policy if exists dibaca_milik_sendiri on po_komentar_dibaca;
create policy dibaca_milik_sendiri on po_komentar_dibaca for all to authenticated
using (oleh = lower(auth.jwt() ->> 'email'))
with check (oleh = lower(auth.jwt() ->> 'email'));

revoke delete on po_komentar_dibaca from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Penjaga
-- ---------------------------------------------------------------------------

/**
 * Saat komentar ditulis.
 *
 * `oleh`, `waktu`, dan `versi_po` diambil dari kenyataan server, bukan dari masukan —
 * `versi_po` palsu membuat komentar basi tampak masih berlaku, dan itu justru penanda
 * yang paling diandalkan pembaca.
 *
 * Penolakan c_level ditaruh di trigger DAN di kebijakan. Di trigger supaya pesannya
 * terbaca ("peran C Level dirancang membaca saja"), di kebijakan supaya penjagaannya
 * tetap berdiri kalau kelak triggernya dilepas.
 */
create or replace function private.jaga_komentar_baru()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_versi integer;
  v_saya  text := lower(auth.jwt() ->> 'email');
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
  return new;
end;
$$;

drop trigger if exists jaga_komentar_baru on po_komentar;
create trigger jaga_komentar_baru
  before insert on po_komentar
  for each row execute function private.jaga_komentar_baru();

/**
 * Saat komentar disunting.
 *
 * Penyalinan ke `po_komentar_revisi` ditaruh di TRIGGER, bukan di dalam
 * `sunting_komentar()`: kalau kelak ada jalur sunting kedua — kebijakan UPDATE yang
 * ditambahkan, skrip perbaikan data, siapa pun dengan `service_role` — revisinya tetap
 * tercatat. Fungsi bisa dilewati; trigger tidak.
 *
 * Kolom selain isi dan penanda dikembalikan ke nilai lama. Komentar tidak berpindah PO,
 * tidak berganti penulis, dan tidak berganti versi.
 */
create or replace function private.jaga_komentar_sunting()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  new.id       := old.id;
  new.po_id    := old.po_id;
  new.oleh     := old.oleh;
  new.waktu    := old.waktu;
  new.versi_po := old.versi_po;

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

-- ---------------------------------------------------------------------------
-- Jalur sunting dan hapus
-- ---------------------------------------------------------------------------

/**
 * Menyunting komentar sendiri. Isi lama disalin trigger, jadi tidak pernah hilang.
 */
create or replace function sunting_komentar(p_id uuid, p_isi text)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh  text;
  v_hapus timestamptz;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  select oleh, dihapus_pada into v_oleh, v_hapus from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) <> v_saya then
    raise exception 'Hanya penulisnya yang bisa menyunting komentar ini.'
      using errcode = 'check_violation';
  end if;
  if v_hapus is not null then
    raise exception 'Komentar ini sudah dihapus.' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_isi, ''))) = 0 then
    raise exception 'Isi komentar tidak boleh kosong.' using errcode = 'check_violation';
  end if;

  update po_komentar set isi = p_isi where id = p_id;
end;
$$;

revoke all on function sunting_komentar(uuid, text) from public, anon;
grant execute on function sunting_komentar(uuid, text) to authenticated;

/**
 * Menghapus komentar sendiri — menandai, bukan membuang. Isinya tetap tersimpan; yang
 * berubah hanya apa yang ditampilkan.
 */
create or replace function hapus_komentar(p_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh text;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  select oleh into v_oleh from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) <> v_saya then
    raise exception 'Hanya penulisnya yang bisa menghapus komentar ini.'
      using errcode = 'check_violation';
  end if;

  update po_komentar
     set dihapus_pada = now(), dihapus_oleh = v_saya
   where id = p_id and dihapus_pada is null;
end;
$$;

revoke all on function hapus_komentar(uuid) from public, anon;
grant execute on function hapus_komentar(uuid) to authenticated;
