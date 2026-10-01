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
-- Tab kedua atau klik ganda tidak boleh mengirim scan dua kali, dan itulah yang menahan biaya:
-- tanpa klaim, penekanan tombol berulang = panggilan berulang.
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

  -- `for update`: dua permintaan berbarengan dengan klaim yang sama harus BERBARIS, bukan
  -- sama-sama lolos pemeriksaan lalu sama-sama menstempel dibaca_ai_pada. Jendelanya sempit
  -- (temuan QA), tetapi penguncian barisnya tidak berbiaya dan menutupnya sepenuhnya.
  select * into v_row from ekstraksi_po where id = p_id for update;
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
