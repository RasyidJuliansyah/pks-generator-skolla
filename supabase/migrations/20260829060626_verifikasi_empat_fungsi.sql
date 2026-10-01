create type fungsi_verifikasi as enum ('education', 'tech_ops', 'finance', 'service_account');
create type hasil_verifikasi as enum ('setuju', 'tolak');

create table verifikasi (
  po_id      uuid not null references po(id) on delete cascade,
  fungsi     fungsi_verifikasi not null,
  hasil      hasil_verifikasi not null,
  catatan    text,
  -- Item daftar periksa yang dicentang, disimpan apa adanya sebagai rekaman
  -- apa yang benar-benar diperiksa saat itu.
  item       jsonb not null default '{}'::jsonb,
  oleh       text not null references pengguna(email),
  waktu      timestamptz not null default now(),
  -- Versi PO saat diverifikasi. Kalau PO direvisi dan bidang yang berubah
  -- menyentuh wilayah fungsi ini, barisnya dihapus supaya diperiksa ulang.
  versi_po   integer not null,
  primary key (po_id, fungsi)
);

alter table verifikasi enable row level security;

create policy verifikasi_lihat on verifikasi for select to authenticated
  using (exists (select 1 from po p where p.id = verifikasi.po_id
                  and private.boleh_lihat_po(p.dibuat_oleh)));

-- Hanya pemegang fungsi bersangkutan yang boleh memberi keputusan, dan hanya
-- saat PO memang sedang dalam tahap verifikasi.
create or replace function private.fungsi_saya_cocok(f fungsi_verifikasi)
returns boolean language sql stable
set search_path = public
as $$
  select case f
    when 'education'       then private.punya_peran('education')
    when 'tech_ops'        then private.punya_peran('tech_ops')
    when 'finance'         then private.punya_peran('finance')
    when 'service_account' then private.punya_peran('service_account')
  end;
$$;

create policy verifikasi_putuskan on verifikasi for insert to authenticated
  with check (
    oleh = lower(auth.jwt() ->> 'email')
    and private.fungsi_saya_cocok(fungsi)
    and exists (select 1 from po p where p.id = verifikasi.po_id and p.status = 'verifikasi')
  );

create policy verifikasi_ubah on verifikasi for update to authenticated
  using (
    private.fungsi_saya_cocok(fungsi)
    and exists (select 1 from po p where p.id = verifikasi.po_id and p.status = 'verifikasi')
  )
  with check (
    oleh = lower(auth.jwt() ->> 'email')
    and private.fungsi_saya_cocok(fungsi)
  );

-- Tech Ops Lead menggerakkan PO keluar dari tahap verifikasi: ke 'terverifikasi'
-- bila keempat lampu hijau lengkap, atau ke 'ditolak' bila ada yang menolak.
create policy po_verifikasi_lanjut on po for update to authenticated
  using (status = 'verifikasi' and private.punya_peran('tech_ops_lead'))
  with check (status in ('verifikasi', 'terverifikasi', 'ditolak')
              and private.punya_peran('tech_ops_lead'));

-- Sales boleh menarik PO yang ditolak kembali ke draf untuk diperbaiki.
create policy po_tolak_ke_draf on po for update to authenticated
  using (status = 'ditolak' and private.milik_sales(dibuat_oleh))
  with check (status in ('ditolak', 'draf') and private.milik_sales(dibuat_oleh));

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
