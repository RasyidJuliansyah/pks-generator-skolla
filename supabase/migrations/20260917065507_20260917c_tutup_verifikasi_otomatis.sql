-- IoM Fase 2 bagian 2 (catatan/15 Tugas 2): PO yang lolos otomatis ditutup Head of Operations
-- dengan satu klik. Isi jaga_penutupan_verifikasi disalin dari definisi hidup 17 Sep 2026;
-- yang ditambahkan hanya cabang jalur IoM.

create or replace function private.jaga_penutupan_verifikasi()
returns trigger language plpgsql set search_path = public
as $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then return NEW; end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak from verifikasi where po_id = NEW.id and berlaku;
  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    -- Jalur IoM: tanpa empat persetujuan, HANYA Head of Operations, tanpa satu pun penolakan,
    -- dan verdict TERAKHIR lolos untuk versi PO ini dan versi IoM yang berlaku.
    -- Peran dicek harfiah lewat peran_saya(), bukan punya_peran(): punya_peran meloloskan
    -- admin_utama untuk peran apa pun, padahal keputusannya "hanya Head of Operations" dan
    -- namanya yang tercetak di Surat (temuan QA putaran 1).
    -- Deklarasi paketnya diperiksa ulang saat menutup: verdict dihitung sekali saat masuk
    -- verifikasi, deklarasi bisa kedaluwarsa atau ditandatangani ulang sesudahnya.
    if tolak > 0 or not ('head_of_operations' = any(private.peran_saya())) or not exists (
         select 1 from (select lolos, versi_po, versi_iom, paket from verifikasi_otomatis
                         where po_id = NEW.id order by dicatat_pada desc limit 1) t
          where t.lolos and t.versi_po = NEW.versi and t.versi_iom = private.versi_iom_berlaku()
            and exists (select 1 from (select berlaku_sampai, butir from deklarasi_kesiapan dk
                                        where dk.produk = t.paket order by dk.ditandatangani_pada desc limit 1) d
                         where d.berlaku_sampai >= (now() at time zone 'Asia/Jakarta')::date
                           and d.butir @> array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4']))
    then
      raise exception 'Belum bisa dinyatakan terverifikasi: % dari 4 fungsi setuju, % menolak.', hijau, tolak;
    end if;
  end if;
  if NEW.status = 'ditolak' and tolak = 0 then
    raise exception 'Tidak ada fungsi yang menolak, jadi PO ini tidak bisa ditutup sebagai ditolak.';
  end if;
  return NEW;
end $$;

-- Jalan HoO. Syarat verdict ditegakkan trigger di atas, bukan di sini, supaya satu tempat saja.
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
  if lower(v_po.dibuat_oleh) = v_saya then
    raise exception 'Pembuat PO tidak boleh menutup verifikasinya sendiri.' using errcode = 'check_violation';
  end if;
  update po set status = 'terverifikasi', diverifikasi_oleh = v_saya, diverifikasi_pada = now()
   where id = p_po;
end $$;

revoke all on function tutup_verifikasi_otomatis(uuid) from public, anon;
grant execute on function tutup_verifikasi_otomatis(uuid) to authenticated;
