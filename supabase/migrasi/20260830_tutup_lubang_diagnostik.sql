-- Menutup lima lubang yang ditemukan diagnostik 2026-08-30. Semuanya dibuktikan
-- lebih dulu dengan simulasi peran di dalam transaksi yang lalu dibatalkan.

------------------------------------------------------------------ 1
-- PO yang sudah dikirim untuk ditandatangani masih bisa diubah isinya lewat
-- PostgREST: kebijakan po_ubah sengaja melonggarkan status menunggu_ttd dan
-- ditandatangani supaya perpindahan status bisa jalan, tapi itu sekaligus
-- membuka kolom uang dan jumlah. Terbukti: sales mengubah grand_total sebuah PO
-- berstatus 'ditandatangani' menjadi 777777.
--
-- Yang menghalangi harus memisahkan "pindah status" dari "ubah isi", dan itu
-- tidak bisa dinyatakan sebagai kebijakan baris. Jadi trigger.
create or replace function private.bekukan_isi_po()
returns trigger language plpgsql set search_path to 'public' as $$
begin
  if OLD.status in ('draf', 'ditolak') then
    return NEW;                     -- masih milik sales, bebas disunting
  end if;
  if (NEW.sekolah_id,  NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru,  NEW.grand_total,  NEW.masa_mulai,  NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor)
     is distinct from
     (OLD.sekolah_id,  OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru,  OLD.grand_total,  OLD.masa_mulai,  OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor)
  then
    raise exception
      'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $$;

drop trigger if exists po_bekukan_isi on po;
create trigger po_bekukan_isi before update on po
  for each row execute function private.bekukan_isi_po();

------------------------------------------------------------------ 2
-- Tech Ops Lead bisa menyatakan sebuah PO terverifikasi tanpa satu pun lampu
-- hijau: syaratnya cuma diperiksa di tutupVerifikasi(), tidak di basis data.
create or replace function private.jaga_penutupan_verifikasi()
returns trigger language plpgsql set search_path to 'public' as $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then
    return NEW;
  end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak
    from verifikasi where po_id = NEW.id and berlaku;

  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    raise exception
      'Belum bisa dinyatakan terverifikasi: % dari 4 fungsi setuju, % menolak.', hijau, tolak;
  end if;
  if NEW.status = 'ditolak' and tolak = 0 then
    raise exception 'Tidak ada fungsi yang menolak, jadi PO ini tidak bisa ditutup sebagai ditolak.';
  end if;
  return NEW;
end $$;

drop trigger if exists po_jaga_penutupan on po;
create trigger po_jaga_penutupan before update on po
  for each row execute function private.jaga_penutupan_verifikasi();

------------------------------------------------------------------ 3
-- pks_sunting memberi sales jalur langsung ke tabel pks: WITH CHECK-nya hanya
-- mensyaratkan final_pada terisi, tidak membatasi kolom lain. Terbukti: sales
-- memfinalisasi PKS bertanggal 2020, menyetel tanggal tanda tangan 2099, dan
-- mengarahkan berkas_basah ke jalur milik PO lain — semua lolos, sementara
-- status PO tidak ikut naik. Seluruh penulisan yang sah lewat fungsi
-- SECURITY DEFINER, jadi kebijakan ini tidak dipakai siapa pun.
drop policy if exists pks_sunting on pks;

------------------------------------------------------------------ 4
-- basikan_verifikasi punya cabang kedua tanpa gerbang status: pemegang peran
-- fungsi bisa membatalkan keputusan fungsinya pada PO mana pun, termasuk yang
-- sudah 'aktif'. Kebijakan verifikasi_ubah mensyaratkan status 'verifikasi';
-- fungsi ini lebih longgar daripada kebijakannya sendiri.
create or replace function public.basikan_verifikasi(
  p_po uuid, p_fungsi fungsi_verifikasi[], p_sebab text)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record;
begin
  select dibuat_oleh, status into r from po where id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;

  if not (
    private.boleh_ubah_po(r.dibuat_oleh, r.status)
    or (cardinality(p_fungsi) = 1
        and private.fungsi_saya_cocok(p_fungsi[1])
        and r.status = 'verifikasi')
  ) then
    raise exception 'Tidak berhak membatalkan keputusan verifikasi';
  end if;

  update verifikasi
     set berlaku = false, digantikan_pada = now(), sebab_basi = p_sebab
   where po_id = p_po and fungsi = any(p_fungsi) and berlaku;
end $$;

------------------------------------------------------------------ 5
-- unggah_pks_basah menerima jalur berkas apa adanya. Kebijakan penyimpanan
-- sudah mengikat unggahan ke awalan id PO, tapi kolomnya bisa diarahkan ke
-- mana saja; menyamakan keduanya menutup selisih itu sekaligus menangkap salah
-- ketik yang selama ini gagal diam-diam.
create or replace function public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date)
returns void language plpgsql security definer set search_path to 'public' as $$
declare r record; s record;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh)) then
    raise exception 'Hanya sales pemilik PO yang bisa mengunggah PKS';
  end if;
  if p_berkas is null or p_berkas not like p_po::text || '/%' then
    raise exception 'Berkas harus berada di folder PO ini';
  end if;

  select final_pada into s from pks where po_id = p_po;
  if not found then raise exception 'PKS belum dibuat'; end if;
  if s.final_pada is null then raise exception 'PKS belum difinalisasi'; end if;
  if p_tanggal > current_date then
    raise exception 'Tanggal penandatanganan tidak boleh di masa depan';
  end if;

  update pks
     set berkas_basah = p_berkas,
         diunggah_oleh = lower(auth.jwt() ->> 'email'),
         diunggah_pada = now(),
         ditandatangani_pada = p_tanggal
   where po_id = p_po;

  update po set status = 'pks_ditandatangani'
   where id = p_po and status in ('terverifikasi', 'pks_terbit');
end $$;

------------------------------------------------------------------ 6
-- Kebijakan bucket tanda-tangan hanya menyebut bucket dan peran, tanpa jalur.
-- Akibatnya siapa pun dari keluarga sales bisa menghapus atau menulis berkas
-- APA PUN di bucket itu — termasuk tanda tangan Tech Ops Lead di bawah surat/
-- yang mestinya wilayahnya sendiri — dan setiap pemegang peran bisa membaca
-- seluruh tanda tangan, bukan hanya PO yang boleh dilihatnya.
--
-- Selain itu tidak ada kebijakan UPDATE sama sekali untuk berkas non-surat,
-- padahal simpanTtd mengunggah dengan upsert. Selama berkas lamanya belum ada
-- itu tidak terasa; begitu PO dikembalikan ke draf — yang menghapus barisnya
-- tapi bukan berkasnya — tanda tangan berikutnya gagal diunggah.
create or replace function private.po_pada_jalur(nama text)
returns uuid language sql immutable set search_path to '' as $$
  select (regexp_match(nama,
    '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'))[1]::uuid;
$$;

drop policy if exists ttd_berkas_baca  on storage.objects;
drop policy if exists ttd_berkas_tulis on storage.objects;
drop policy if exists ttd_berkas_hapus on storage.objects;

create policy ttd_berkas_baca on storage.objects for select to authenticated
using (
  bucket_id = 'tanda-tangan'
  and exists (select 1 from po p
               where p.id = private.po_pada_jalur(objects.name)
                 and private.boleh_lihat_po(p.dibuat_oleh))
);

-- Cerminan kebijakan baris ttd_bubuh/ttd_hapus: PO sedang menunggu tanda tangan,
-- dan penggunanya pemilik PO atau atasannya. Awalan surat/ dikecualikan karena
-- punya kebijakan sendiri milik Tech Ops Lead.
create policy ttd_berkas_tulis on storage.objects for insert to authenticated
with check (
  bucket_id = 'tanda-tangan' and objects.name not like 'surat/%'
  and exists (select 1 from po p
               where p.id = private.po_pada_jalur(objects.name)
                 and p.status = 'menunggu_ttd'
                 and (p.dibuat_oleh = lower(auth.jwt() ->> 'email')
                      or private.punya_peran('head_of_sales', 'admin_sales')))
);

create policy ttd_berkas_ganti on storage.objects for update to authenticated
using (
  bucket_id = 'tanda-tangan' and objects.name not like 'surat/%'
  and exists (select 1 from po p
               where p.id = private.po_pada_jalur(objects.name)
                 and p.status = 'menunggu_ttd'
                 and (p.dibuat_oleh = lower(auth.jwt() ->> 'email')
                      or private.punya_peran('head_of_sales', 'admin_sales')))
);

create policy ttd_berkas_hapus on storage.objects for delete to authenticated
using (
  bucket_id = 'tanda-tangan' and objects.name not like 'surat/%'
  and exists (select 1 from po p
               where p.id = private.po_pada_jalur(objects.name)
                 and p.status = 'menunggu_ttd'
                 and (p.dibuat_oleh = lower(auth.jwt() ->> 'email')
                      or private.punya_peran('head_of_sales', 'admin_sales')))
);
