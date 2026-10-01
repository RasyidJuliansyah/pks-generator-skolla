-- Pembuat PO boleh menutup verifikasinya sendiri bila ia Head of Operations
-- (keputusan Rizki 22 Sep 2026, catatan/13a Bagian 10).
--
-- Aturan lama "pembuat tidak boleh menutup verifikasinya sendiri" adalah pemisahan tugas
-- yang sehat, tapi di Skolla ia menutup satu-satunya HoO aktif dari PO buatannya sendiri:
-- PO-344 buatan Rizki lolos otomatis tetapi tak ada HoO lain yang bisa menutupnya, jadi
-- jatuh ke keempat fungsi. Karena hanya ada satu HoO, aturan itu tidak memisahkan siapa pun
-- dari siapa; ia cuma menambah satu jalan memutar.
--
-- Yang TIDAK berubah: penutupan tetap HANYA Head of Operations (peran harfiah lewat
-- peran_saya(), bukan punya_peran()), tanpa satu pun penolakan, dengan verdict lolos untuk
-- versi PO ini, dan deklarasi tiap paketnya masih berlaku. Trigger penutupan tidak pernah
-- memeriksa pembuat, jadi tidak perlu diubah. Pemisahan tugas pada jalur verifikasi manual
-- (empat fungsi) juga tidak berubah.
--
-- Badan fungsi disalin dari YANG HIDUP DI PRODUKSI; hanya blok pemeriksaan pembuat yang
-- dibuang.

create or replace function public.tutup_verifikasi_otomatis(p_po uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_saya text := lower(auth.jwt() ->> 'email');
  v_po po%rowtype;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if not ('head_of_operations' = any(private.peran_saya())) then
    raise exception 'Hanya Head of Operations yang bisa menutup PO yang lolos verifikasi otomatis.'
      using errcode = 'check_violation';
  end if;
  select * into v_po from po where id = p_po for update;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_po.status <> 'verifikasi' then
    raise exception 'PO tidak sedang dalam tahap verifikasi.' using errcode = 'check_violation';
  end if;
  update po set status = 'terverifikasi', diverifikasi_oleh = v_saya, diverifikasi_pada = now()
   where id = p_po;
end $$;

revoke all on function tutup_verifikasi_otomatis(uuid) from public, anon;
grant execute on function tutup_verifikasi_otomatis(uuid) to authenticated;
