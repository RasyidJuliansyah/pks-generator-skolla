-- Lantai bottom price ditegakkan DI BASIS DATA, bukan hanya di server action.
--
-- Sebelum ini `periksa()` di lib/po-aksi.ts adalah satu-satunya penjaga lantai, dan
-- kebijakan RLS `po_buat` mengizinkan peran sales menyisipkan baris `po` tanpa
-- memeriksa harga sama sekali. Sudah DIBUKTIKAN bisa ditembus lewat PostgREST: sebuah
-- PO dengan harga_siswa = 1000 berikut delapan komponen LMS Juara berhasil masuk,
-- padahal lantainya 186.000. Lihat catatan/02-jebakan-dan-bug.md.
--
-- Amandemen sempit terhadap catatan/01-keputusan-arsitektur.md: harga BOLEH masuk DB
-- sebatas price list dan bottom price. ACQUISITION PRICE TIDAK PERNAH. Alasan aturan
-- aslinya seluruhnya tentang melindungi acquisition, sementara bottom price memang
-- dilihat semua peran (lib/po-aksi.ts: "Semua peran melihat Bottom Price").

create table if not exists harga_komponen (
  id         text primary key,
  price_list bigint  not null,
  bottom     bigint  not null,
  grup       text    not null check (grup in ('core', 'addon')),
  untuk_guru boolean not null default false,
  per_sesi   boolean not null default false
);

create table if not exists harga_paket (
  nama       text primary key,
  ids        text[] not null,          -- DIURUTKAN, supaya bisa dibandingkan langsung
  price_list bigint not null,
  bottom     bigint not null
);

create table if not exists pricelist_aktif (
  satu_baris     boolean primary key default true check (satu_baris),
  versi          text not null,
  diperbarui_pada timestamptz not null default now()
);
insert into pricelist_aktif (versi) values ('belum diisi') on conflict do nothing;

-- Tabel harga bukan rahasia, tapi juga bukan urusan klien: tidak ada kebijakan RLS
-- yang mengizinkan siapa pun membacanya lewat PostgREST. Yang memakainya hanya fungsi
-- SECURITY DEFINER di bawah. Menutup tabel lebih murah daripada menjaganya.
alter table harga_komponen  enable row level security;
alter table harga_paket     enable row level security;
alter table pricelist_aktif enable row level security;
revoke all on harga_komponen, harga_paket, pricelist_aktif from anon, authenticated;

/**
 * Lantai per siswa untuk sebuah PO. Meniru lib/hitung.ts:
 *   · komponen INTI yang persis sebuah paket -> harga paket
 *   · selain itu -> jumlah komponen
 *   · add-on per sesi SELALU ditambahkan di atasnya, dikali jumlah sesinya
 * Komponen guru tidak ikut; lantainya dihitung terpisah.
 */
create or replace function private.lantai_siswa(p_po uuid)
returns bigint
language sql
stable
security definer
set search_path to public
as $$
  with k as (
    select pk.sesi, h.id, h.bottom, h.grup, h.untuk_guru
    from po_komponen pk
    join harga_komponen h on h.id = pk.komponen_id
    where pk.po_id = p_po
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

/** Lantai per guru. Komponen guru selalu per sesi. */
create or replace function private.lantai_guru(p_po uuid)
returns bigint
language sql
stable
security definer
set search_path to public
as $$
  select coalesce(sum(h.bottom * greatest(pk.sesi, 1)), 0)
  from po_komponen pk
  join harga_komponen h on h.id = pk.komponen_id
  where pk.po_id = p_po and h.untuk_guru;
$$;

/**
 * Penjaga lantai.
 *
 * Diperiksa TEPAT SEKALI: pada transisi PO meninggalkan draf/ditolak. Sesudah itu
 * `bekukan_isi_po` sudah menjamin `harga_siswa` dan `harga_guru` MUSTAHIL berubah —
 * PO berstatus lanjut yang isinya disentuh langsung ditolak trigger itu. Jadi memeriksa
 * ulang di setiap pembaruan bukan cuma mubazir, tapi berbahaya: ia akan MEMBEKUKAN PO
 * lama yang harganya di bawah lantai sekarang, sehingga tidak bisa dimajukan lagi.
 *
 * Konsekuensi yang disengaja: PO yang SUDAH terlanjur melewati draf sebelum trigger ini
 * ada tidak diperiksa surut. Per 9 Sep 2026 ada satu — PO-1, status pks_terbit, harga
 * 158.000 sementara lantainya kini 186.000. Memeriksanya surut berarti mengunci PO yang
 * sudah berjalan, dan itu memperbaiki catatan lama dengan cara merusak yang hidup.
 *
 * Cakupannya tetap utuh: satu-satunya jalan membuat PO berharga di bawah lantai adalah
 * lewat transisi draf -> maju, dan transisi itu diperiksa. PO baru pun dipaksa lahir
 * sebagai draf, supaya penyisipan langsung lewat PostgREST tidak bisa melompati transisi
 * itu dengan langsung berstatus verifikasi tanpa komponen apa pun.
 */
create or replace function private.jaga_lantai_po()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_siswa bigint;
  v_guru  bigint;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draf' then
      raise exception 'PO baru harus berstatus draf, bukan %', new.status
        using errcode = 'check_violation';
    end if;
    return new;                      -- draf belum perlu punya harga yang benar
  end if;

  -- Hanya transisi draf/ditolak -> maju yang diperiksa.
  if old.status not in ('draf', 'ditolak') then return new; end if;
  if new.status in ('draf', 'ditolak') then return new; end if;

  v_siswa := private.lantai_siswa(new.id);
  v_guru  := private.lantai_guru(new.id);

  if v_siswa > 0 and new.harga_siswa < v_siswa then
    raise exception 'Harga siswa % di bawah bottom price (% per siswa).',
      new.harga_siswa, v_siswa using errcode = 'check_violation';
  end if;

  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).',
      new.harga_guru, v_guru using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_lantai_po on po;
create trigger jaga_lantai_po
  before insert or update on po
  for each row execute function private.jaga_lantai_po();
