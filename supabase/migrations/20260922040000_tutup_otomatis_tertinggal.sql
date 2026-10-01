-- Menutup PO yang sudah lolos IoM tetapi belum tertutup otomatis: sisa dari SEBELUM
-- penutupan otomatis ada.
--
-- Lubangnya begini. Trigger `po_tutup_otomatis` menyala `after insert on verifikasi_otomatis`
-- — hanya untuk verdict yang BARU. Verdict PO-344 ditulis 21 Sep lewat
-- `20260921120000_segarkan_verdict_po344` (dihitung ulang dengan tangan, sebab
-- `catat_verdict_iom` hanya menilai saat PO MASUK verifikasi), jadi tidak ada yang
-- memicunya. Backfill di `20260922c` pun tidak menjangkaunya: WHERE-nya menuntut
-- `status='terverifikasi'`, sementara PO-344 masih `verifikasi`.
--
-- Akibatnya PO-344 menggantung: lolos seluruh aturan mesin, tetapi tidak ada jalan
-- menutupnya — tombol HoO satu-klik sudah dihapus, dan keempat fungsi tidak bisa menutup
-- tanpa empat lampu hijau. Ia satu-satunya PO dalam keadaan itu di produksi; PO-067 juga
-- berstatus `verifikasi`, tapi belum punya verdict sama sekali sehingga tidak memenuhi
-- syarat di bawah.
--
-- Syaratnya SAMA PERSIS dengan percabangan IoM di `private.jaga_penutupan_verifikasi()`,
-- disalin dari sana supaya tidak ada PO yang ditutup berdasarkan penilaian yang berbeda.
-- Bila syaratnya meleset sedikit pun, trigger penutupan akan menolaknya dan migrasi ini
-- GAGAL — dan itu memang yang diinginkan: lebih baik berisik daripada menutup PO yang salah.
--
-- TIDAK punya padanan di `supabase/migrasi/`: ia murni memperbaiki data produksi, dan pada
-- basis data yang dibangun dari nol tidak ada PO di `verifikasi`, sehingga badannya no-op.
-- Pola yang sama dengan `20260921120000_segarkan_verdict_po344.sql`.

do $$
declare
  v_po uuid;
  v_jumlah int := 0;
begin
  for v_po in
    select p.id from po p
     where p.status = 'verifikasi'
       and (select count(*) from verifikasi v
             where v.po_id = p.id and v.berlaku and v.hasil = 'tolak') = 0
       and exists (
         select 1 from (select lolos, versi_po, versi_iom, paket, kelompok from verifikasi_otomatis
                         where po_id = p.id order by dicatat_pada desc limit 1) t
          where t.lolos and t.versi_po = p.versi and t.versi_iom = private.versi_iom_berlaku()
            and cardinality(coalesce(t.kelompok, array[t.paket])) > 0
            and not exists (
              select 1 from unnest(coalesce(t.kelompok, array[t.paket])) pk
               where not exists (
                 select 1 from (select berlaku_sampai, butir from deklarasi_kesiapan dk
                                 where dk.produk = pk order by dk.ditandatangani_pada desc limit 1) d
                  where d.berlaku_sampai >= (now() at time zone 'Asia/Jakarta')::date
                    and d.butir @> array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4'])))
  loop
    perform private.tutup_otomatis(v_po);
    v_jumlah := v_jumlah + 1;
  end loop;
  raise notice 'PO yang ditutup otomatis oleh migrasi ini: %', v_jumlah;
end $$;
