-- PO hanya menyimpan sekolah_id, sementara Surat, PKS, dan PDF unduhan membaca
-- nama sekolah, nama kepala sekolah, dan alamat HIDUP dari baris `sekolah`.
-- Baris itu dipakai bersama semua sales — `simpanDraf` menyatukannya lewat NPSN
-- lalu meng-update-nya — dan kebijakan `sekolah_ubah` mengizinkan seluruh
-- keluarga sales mengubahnya. Terbukti lewat simulasi: Sales A bisa menimpa
-- data sekolah milik Sales B.
--
-- Akibatnya bukan sekadar tabrakan data: PKS yang sudah difinalisasi dan
-- ditandatangani basah di atas meterai akan MENCETAK NAMA BERBEDA bila sales
-- lain membetulkan ejaan sekolah itu kemudian. Trigger po_bekukan_isi
-- membekukan kolom PO, tapi sekolah yang ditunjuknya masih bisa berubah —
-- pembekuannya belum utuh.
--
-- Salinan datanya karena itu ikut disimpan di PO dan ikut dibekukan. Diisi
-- trigger, bukan kode aplikasi, supaya tidak bergantung pada satu jalur simpan.
--
-- Sisi aplikasi: pakai sekolahDokumen(po) di lib/dokumen-dari-po.ts, jangan
-- po.sekolah. Dijaga uji/sekolah-beku.test.mjs.
alter table po add column if not exists sekolah_beku jsonb;

-- Backfill lebih dulu, selagi bekukan_isi_po belum mengenal kolomnya — kalau
-- dibalik, trigger pembekuan menolak backfill-nya sendiri. Sudah kejadian saat
-- migrasinya diuji.
update po p set sekolah_beku = (select to_jsonb(s) - 'id' - 'dibuat_pada' - 'diubah_pada'
                                  from sekolah s where s.id = p.sekolah_id)
 where sekolah_beku is null;

create or replace function private.bekukan_sekolah()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  if TG_OP = 'INSERT' or OLD.status in ('draf', 'ditolak') then
    select to_jsonb(s) - 'id' - 'dibuat_pada' - 'diubah_pada'
      into NEW.sekolah_beku from sekolah s where s.id = NEW.sekolah_id;
  end if;
  return NEW;
end $fn$;
drop trigger if exists po_bekukan_sekolah on po;
create trigger po_bekukan_sekolah before insert or update on po
  for each row execute function private.bekukan_sekolah();

-- sekolah_beku masuk daftar beku. Namanya sengaja diurutkan setelah
-- po_bekukan_isi: pembekuan menilai lebih dulu, penyegaran menyusul.
create or replace function private.bekukan_isi_po()
returns trigger language plpgsql set search_path to 'public' as $fn$
begin
  if OLD.status in ('draf', 'ditolak') then return NEW; end if;
  if (NEW.sekolah_id, NEW.sekolah_beku, NEW.jumlah_siswa, NEW.jumlah_guru, NEW.harga_siswa,
      NEW.harga_guru, NEW.grand_total, NEW.masa_mulai, NEW.masa_selesai,
      NEW.sumber_dana, NEW.sumber_dana_lain, NEW.kota, NEW.tanggal_ttd,
      NEW.jumlah_rombel, NEW.nama_pm, NEW.nama_sm, NEW.versi_pricelist,
      NEW.dibuat_oleh, NEW.nomor)
     is distinct from
     (OLD.sekolah_id, OLD.sekolah_beku, OLD.jumlah_siswa, OLD.jumlah_guru, OLD.harga_siswa,
      OLD.harga_guru, OLD.grand_total, OLD.masa_mulai, OLD.masa_selesai,
      OLD.sumber_dana, OLD.sumber_dana_lain, OLD.kota, OLD.tanggal_ttd,
      OLD.jumlah_rombel, OLD.nama_pm, OLD.nama_sm, OLD.versi_pricelist,
      OLD.dibuat_oleh, OLD.nomor)
  then raise exception 'PO berstatus % tidak bisa diubah isinya. Kembalikan ke draf dulu.', OLD.status;
  end if;
  return NEW;
end $fn$;
