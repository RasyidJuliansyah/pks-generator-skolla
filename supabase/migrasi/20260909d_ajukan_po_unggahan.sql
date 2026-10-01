-- Melengkapi alur PO unggahan: dari draf langsung ke `ditandatangani`, berikut tiga
-- baris tanda tangan yang berasal dari pindaian.
--
-- Kenapa RPC, bukan melebarkan kebijakan RLS `ttd_bubuh`:
--
--   1. ATOMIK. Tiga tanda tangan dan lompatan status harus terjadi sekaligus atau tidak
--      sama sekali. Lewat panggilan klien terpisah, kegagalan di tengah meninggalkan PO
--      dengan dua tanda tangan — keadaan yang tidak pernah sah.
--   2. `ttd_bubuh` menuntut status `menunggu_ttd`. Melebarkannya supaya menerima draf
--      berarti Sales bisa menyisipkan tanda tangan sembarangan ke draf mana pun.
--
-- `security definer` melewati RLS, jadi kepemilikan diperiksa SENDIRI di dalam fungsi —
-- bukan diandalkan pada kebijakan yang sudah tidak berlaku di sini.

create or replace function ajukan_po_unggahan(p_po uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_po   po%rowtype;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  select * into v_po from po where id = p_po;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if not (lower(v_po.dibuat_oleh) = v_saya
          or private.punya_peran('head_of_sales', 'admin_sales')) then
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
  -- Tidak ada mesin yang bisa menggantikan ini, jadi ia dijadikan syarat keras.
  if v_po.ditinjau_pada is null then
    raise exception 'Belum ada pernyataan bahwa data ini sesuai dengan pindaian.'
      using errcode = 'check_violation';
  end if;

  -- PO yang pernah ditolak lalu diajukan ulang tidak boleh menumpuk tanda tangan.
  delete from tanda_tangan where po_id = p_po;

  -- Ketiganya menunjuk BERKAS YANG SAMA: tanda tangannya memang ada di dalam satu
  -- lembar pindaian, bukan sebagai tiga gambar terpisah.
  insert into tanda_tangan (po_id, pihak, nama, berkas, dibubuhkan_oleh, asal) values
    (p_po, 'kepala_sekolah',
       coalesce(nullif(btrim(v_po.sekolah_beku->>'kepala_sekolah'), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'partnership_manager',
       coalesce(nullif(btrim(v_po.nama_pm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian'),
    (p_po, 'sales_manager',
       coalesce(nullif(btrim(v_po.nama_sm), ''), '—'),
       v_po.berkas_unggahan, v_saya, 'pindaian');

  -- Lompatan status ini yang memicu `jaga_lantai_po`. Jadi PO unggahan di bawah lantai
  -- tetap tertahan di sini kecuali ada pengecualian yang masih cocok — gerbangnya sama
  -- persis dengan jalur platform, tidak ada pintu belakang.
  update po set status = 'ditandatangani' where id = p_po;
end;
$$;

revoke all on function ajukan_po_unggahan(uuid) from public, anon;
grant execute on function ajukan_po_unggahan(uuid) to authenticated;
