-- Dokumen sponsorship di tahap PKS: tabel konfirmasi Finance, dan gerbang unggah PKS basah.
--
-- Melaksanakan catatan/18 bagian "Dokumen sponsorship di tahap PKS", lewat catatan/19 Tugas 3.
--
-- Berlaku untuk SETIAP PO bersponsorship, lolos otomatis maupun manual. Unggahan PKS
-- bertanda tangan basah adalah langkah terakhir kesepakatan, dan dokumen sponsorship
-- ditandatangani bersama PKS — jadi gerbangnya di situ, bukan di layar.
--
-- DIBUKTIKAN SEBELUMNYA, dalam transaksi yang dibatalkan: PO bersponsorship bisa diunggah
-- PKS basahnya tanpa konfirmasi apa pun.

create table pks_dokumen_sponsorship (
  po_id uuid primary key references po(id) on delete cascade,
  -- Konfirmasi terikat VERSI PO yang dikonfirmasi. PO yang berubah menaikkan versi, dan
  -- konfirmasi lama otomatis tidak berlaku lagi — bukan karena ada yang menghapusnya,
  -- melainkan karena nomornya tidak cocok.
  versi_po integer not null,
  form_ditandatangani boolean not null,
  rekening_atas_nama_lembaga boolean not null,
  meterai_bila_di_atas_5juta boolean not null,
  oleh text not null,
  pada timestamptz not null default now()
);

comment on table pks_dokumen_sponsorship is
  'Konfirmasi Finance bahwa dokumen sponsorship sebuah PO sudah beres (catatan/18). '
  'Terikat versi_po: konfirmasi untuk versi yang bukan versi PO sekarang tidak berlaku.';

alter table pks_dokumen_sponsorship enable row level security;

-- Baca: siapa pun yang boleh melihat PO-nya. Pola sama dengan pks_lihat dan po_catatan_lihat.
create policy pks_dok_sp_lihat on pks_dokumen_sponsorship for select
  using (exists (select 1 from po p
                 where p.id = pks_dokumen_sponsorship.po_id
                   and private.boleh_lihat_po(p.dibuat_oleh)));

-- Tulis: HANYA peran finance HARFIAH.
--
-- Sengaja `'finance' = any(private.peran_saya())`, BUKAN private.punya_peran('finance'):
-- punya_peran meloloskan admin_utama untuk peran apa pun (fungsi itu MENGIZINKAN, bukan
-- menjawab "perannya apa"), dan butir d4 ini milik Finance, bukan milik siapa saja yang
-- berwenang. Idiom yang sama dipakai penutupan IoM untuk head_of_operations.
--
-- WITH CHECK juga memaksa: versi yang dikonfirmasi = versi PO sekarang, dan `oleh` adalah
-- pemanggilnya sendiri. Tanpa yang kedua, Finance bisa menulis nama orang lain di kolom itu.
create policy pks_dok_sp_tulis on pks_dokumen_sponsorship for all
  using ('finance' = any(private.peran_saya()))
  with check (
    'finance' = any(private.peran_saya())
    and lower(oleh) = lower(auth.jwt() ->> 'email')
    and exists (select 1 from po p where p.id = pks_dokumen_sponsorship.po_id
                                     and p.versi = pks_dokumen_sponsorship.versi_po));

revoke all on pks_dokumen_sponsorship from anon;
grant select, insert, update on pks_dokumen_sponsorship to authenticated;

-- Gerbang: PKS bertanda tangan basah tidak bisa diunggah selama PO bersponsorship belum
-- punya konfirmasi yang BERLAKU dengan ketiga centang.
--
-- Ditegakkan di sini, bukan di layar: layar hanya menjelaskan, basis data yang menolak.
create or replace function public.unggah_pks_basah(p_po uuid, p_berkas text, p_tanggal date)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare r record; s record; v_sponsor boolean;
begin
  select p.dibuat_oleh, p.status into r from po p where p.id = p_po;
  if not found then raise exception 'PO tidak ditemukan'; end if;
  if not (private.punya_peran('sales', 'head_of_sales', 'admin_sales')
          and private.milik_sales(r.dibuat_oleh))
  then raise exception 'Hanya sales pemilik PO yang bisa mengunggah PKS'; end if;
  if p_berkas is null or p_berkas not like p_po::text || '/%' then
    raise exception 'Berkas harus berada di folder PO ini';
  end if;
  select final_pada into s from pks where po_id = p_po;
  if not found then raise exception 'PKS belum dibuat'; end if;
  if s.final_pada is null then raise exception 'PKS belum difinalisasi'; end if;
  if p_tanggal > current_date then
    raise exception 'Tanggal penandatanganan tidak boleh di masa depan';
  end if;

  -- PO lama tanpa nilai tetap wajib dikonfirmasi dokumennya; nilainya yang tidak dituntut.
  select exists (select 1 from po_catatan
                 where po_id = p_po and jenis = 'sponsorship' and btrim(coalesce(isi, '')) <> '')
      or coalesce((select nilai_sponsorship from po where id = p_po), 0) > 0
    into v_sponsor;
  if v_sponsor and not exists (
    select 1 from pks_dokumen_sponsorship d
    join po p on p.id = d.po_id
    where d.po_id = p_po
      and d.versi_po = p.versi
      and d.form_ditandatangani
      and d.rekening_atas_nama_lembaga
      and d.meterai_bila_di_atas_5juta)
  then
    raise exception 'PO ini bersponsorship. Finance harus mengonfirmasi dokumen sponsorship '
      'untuk versi PO sekarang sebelum PKS bertanda tangan basah bisa diunggah.';
  end if;

  update pks set berkas_basah = p_berkas, diunggah_oleh = lower(auth.jwt() ->> 'email'),
         diunggah_pada = now(), ditandatangani_pada = p_tanggal
   where po_id = p_po;
  update po set status = 'pks_ditandatangani'
   where id = p_po and status in ('terverifikasi', 'pks_terbit');
end $function$;
