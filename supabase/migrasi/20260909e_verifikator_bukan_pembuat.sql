-- Pembuat PO tidak boleh ikut memverifikasi PO-nya sendiri.
--
-- Ditemukan 9 Sep 2026 dan DIBUKTIKAN di basis data sungguhan: `farid@` memegang
-- `finance` sekaligus `sales`, membuat PO, memajukannya ke verifikasi, lalu
-- memverifikasinya sendiri sebagai Finance — dan lolos.
--
-- Kebijakan `verifikasi_putuskan` memeriksa apakah peran cocok dengan fungsinya, tapi
-- tidak pernah memeriksa siapa yang membuat PO-nya. Karena `pengguna.peran` bertipe
-- array, satu orang memang bisa memegang dua peran sekaligus — dan per 9 Sep ada dua
-- orang seperti itu (`farid@` finance+sales, `bintang@` admin_sales+sales).
--
-- Ini masalah yang sama dengan "penyetuju bukan pengunggah" pada po_pengecualian,
-- tetapi di jalur yang jauh lebih sering dilalui.
--
-- Ditaruh di TRIGGER, bukan menambah syarat di kebijakan RLS: RLS menolak dengan pesan
-- generik "violates row-level security policy", sedangkan verifikator perlu tahu bahwa
-- penolakannya karena ia pembuat PO-nya, bukan karena perannya salah.
--
-- SECURITY DEFINER penting dan bukan kebiasaan: tanpa itu, RLS bisa menyembunyikan
-- baris PO dari pemanggil, `dibuat_oleh` terbaca null, dan pemeriksaan ini lolos begitu
-- saja — penjaga yang justru membuka pintu yang mau ditutupnya.

create or replace function private.jaga_verifikator_bukan_pembuat()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_pemilik text;
begin
  select dibuat_oleh into v_pemilik from po where id = new.po_id;

  -- PO tidak ditemukan berarti ada yang salah; jangan diam-diam meloloskan.
  if v_pemilik is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  if lower(v_pemilik) = lower(auth.jwt() ->> 'email') then
    raise exception 'Kamu yang membuat PO ini, jadi tidak bisa ikut memverifikasinya. '
      'Minta pemegang fungsi % yang lain.', new.fungsi
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_verifikator_bukan_pembuat on verifikasi;
create trigger jaga_verifikator_bukan_pembuat
  before insert or update on verifikasi
  for each row execute function private.jaga_verifikator_bukan_pembuat();

-- Pengaman berlapis untuk langkah terakhir verifikasi. Tech Ops Lead hari ini tidak
-- bisa membuat PO (`po_buat` hanya mengizinkan sales, head_of_sales, admin_sales), jadi
-- ini belum bisa terjadi — tapi peran bertipe array, dan yang menahannya sekarang cuma
-- kebetulan belum ada yang memegang keduanya.
drop policy if exists po_verifikasi_lanjut on po;
create policy po_verifikasi_lanjut on po for update to authenticated
using (
  status = 'verifikasi'
  and private.punya_peran('tech_ops_lead')
  and dibuat_oleh <> lower(auth.jwt() ->> 'email')
)
with check (
  status in ('verifikasi', 'terverifikasi', 'ditolak')
  and private.punya_peran('tech_ops_lead')
  and dibuat_oleh <> lower(auth.jwt() ->> 'email')
);
