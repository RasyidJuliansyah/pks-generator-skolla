-- Perbaikan sekali jalan. PKS yang difinalisasi SEBELUM status PO tersambung
-- (migrasi unggah_pks_basah) meninggalkan baris yang PKS-nya sudah final tapi
-- POnya masih 'terverifikasi' — tampil keliru sebagai "Belum terbit".
--
-- Diselaraskan dari keadaan PKS-nya, bukan ditebak: ada berkas basah berarti
-- sudah ditandatangani, final saja berarti baru terbit.
update po p
   set status = 'pks_ditandatangani'
  from pks k
 where k.po_id = p.id
   and k.berkas_basah is not null
   and p.status in ('terverifikasi', 'pks_terbit');

update po p
   set status = 'pks_terbit'
  from pks k
 where k.po_id = p.id
   and k.final_pada is not null
   and k.berkas_basah is null
   and p.status = 'terverifikasi';
