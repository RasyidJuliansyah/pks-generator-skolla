-- Langkah 2 dari catatan/08-spesifikasi-po-unggahan.md: gerbang pengecualian.
--
-- Kertas yang sudah ditandatangani tidak bisa dibatalkan. Kalau harganya di bawah
-- lantai, menolak begitu saja membuat PO-nya buntu. Maka: boleh maju, TAPI hanya dengan
-- persetujuan eksplisit Head of Operations yang tercatat.
--
-- CAKUPAN, disebut terang supaya tidak dikira lebih luas daripada yang sebenarnya:
-- gerbang ini menjaga LANTAI HARGA saja. Pelanggaran lain di `periksa()` — batas
-- minimal peserta, kapasitas sesi, total termin — tidak bisa dihitung basis data karena
-- logikanya ada di aplikasi, dan tetap ditolak keras di server action. Lantai yang
-- dijaga di sini karena ia satu-satunya yang bocor uang.

create table if not exists po_pengecualian (
  po_id            uuid primary key references po(id) on delete cascade,
  -- ANGKA, bukan cuma teks: persetujuan harus mati sendiri kalau harga atau
  -- komponennya berubah sesudah disetujui.
  lantai_disetujui bigint not null,
  harga_disetujui  bigint not null,
  -- Salinan pesan periksa() saat disetujui — apa yang benar-benar dilihat penyetujunya.
  pelanggaran      text[] not null,
  alasan           text   not null check (length(btrim(alasan)) > 0),
  disetujui_oleh   text   not null,
  disetujui_pada   timestamptz not null default now()
);

alter table po_pengecualian enable row level security;

drop policy if exists pengecualian_lihat on po_pengecualian;
create policy pengecualian_lihat on po_pengecualian for select to authenticated
using (exists (select 1 from po p
               where p.id = po_pengecualian.po_id
                 and private.boleh_lihat_po(p.dibuat_oleh)));

drop policy if exists pengecualian_beri on po_pengecualian;
create policy pengecualian_beri on po_pengecualian for insert to authenticated
with check (private.punya_peran('head_of_operations'));

-- Tidak ada kebijakan UPDATE maupun DELETE: persetujuan adalah catatan, bukan draf.
-- Kalau keadaannya berubah, angkanya tidak akan cocok lagi dan persetujuannya batal
-- dengan sendirinya — tidak perlu disunting.

/**
 * Penjaga saat persetujuan dibuat.
 *
 * Ditaruh di trigger, bukan RLS: RLS menolak dengan diam (0 baris), sedangkan orang yang
 * menyetujui perlu tahu KENAPA ditolak.
 */
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

  -- Pengecualian hanya untuk jalur unggah. PO yang dibuat di platform tidak pernah
  -- bisa melanggar lantai sejak awal, jadi tidak ada yang perlu dikecualikan.
  if v_po.asal <> 'unggahan' then
    raise exception 'Pengecualian hanya untuk PO unggahan, bukan PO yang dibuat di platform.'
      using errcode = 'check_violation';
  end if;

  -- Penyetuju bukan pengunggah. Head of Operations memang tidak bisa membuat PO, tapi
  -- `pengguna.peran` bertipe array sehingga satu orang bisa memegang dua peran —
  -- pemisahannya harus ditegakkan, bukan diandalkan pada kebetulan.
  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Penyetuju tidak boleh orang yang sama dengan pembuat PO.'
      using errcode = 'check_violation';
  end if;

  new.disetujui_oleh := v_saya;   -- diambil dari sesi, bukan dari masukan

  -- Angka yang disetujui harus angka yang BERLAKU saat itu, bukan angka yang dikirim
  -- pemanggil. Kalau tidak, persetujuan bisa dibuat untuk keadaan yang tidak pernah ada.
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

drop trigger if exists jaga_pengecualian on po_pengecualian;
create trigger jaga_pengecualian
  before insert on po_pengecualian
  for each row execute function private.jaga_pengecualian();

/**
 * Penjaga lantai, diperluas: mengakui pengecualian yang MASIH cocok.
 *
 * Persetujuan berlaku untuk keadaan yang dilihat penyetujunya, bukan untuk PO itu
 * selamanya. Kalau harga atau susunan komponennya berubah sesudah disetujui, angkanya
 * tidak cocok lagi dan persetujuannya batal dengan sendirinya — tanpa perlu dicabut.
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
  v_ok    boolean;
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

  v_siswa := private.lantai_siswa(new.id);
  v_guru  := private.lantai_guru(new.id);

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

  if v_guru > 0 and new.jumlah_guru > 0 and new.harga_guru < v_guru then
    raise exception 'Harga guru % di bawah bottom price (% per guru).',
      new.harga_guru, v_guru using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

-- RLS sudah menahan UPDATE dan DELETE, tapi menahannya DIAM-DIAM: pemanggil menerima
-- sukses dengan nol baris. Untuk catatan persetujuan, penolakannya sebaiknya terdengar.
revoke update, delete on po_pengecualian from authenticated, anon;
