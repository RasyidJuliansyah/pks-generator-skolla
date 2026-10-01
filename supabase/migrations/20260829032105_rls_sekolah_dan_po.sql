alter table sekolah     enable row level security;
alter table po          enable row level security;
alter table po_komponen enable row level security;
alter table po_rombel   enable row level security;
alter table po_termin   enable row level security;
alter table po_catatan  enable row level security;

-- Sales hanya melihat PO buatannya sendiri. Enam peran lain melihat seluruhnya.
create or replace function private.boleh_lihat_po(pemilik text)
returns boolean language sql stable
set search_path = public
as $$
  select private.boleh_lihat_semua()
      or pemilik = lower(auth.jwt() ->> 'email');
$$;

-- Yang boleh menyunting: pembuatnya sendiri, Head of Sales, Admin Sales.
-- Hanya selama PO masih draf atau dikembalikan setelah ditolak.
create or replace function private.boleh_ubah_po(pemilik text, st status_po)
returns boolean language sql stable
set search_path = public
as $$
  select st in ('draf', 'ditolak')
     and (pemilik = lower(auth.jwt() ->> 'email')
          or private.punya_peran('head_of_sales', 'admin_sales'));
$$;

create policy po_lihat on po for select to authenticated
  using (private.boleh_lihat_po(dibuat_oleh));

create policy po_buat on po for insert to authenticated
  with check (
    dibuat_oleh = lower(auth.jwt() ->> 'email')
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
  );

create policy po_ubah on po for update to authenticated
  using (private.boleh_ubah_po(dibuat_oleh, status))
  with check (private.boleh_ubah_po(dibuat_oleh, status));

create policy po_hapus on po for delete to authenticated
  using (status = 'draf' and dibuat_oleh = lower(auth.jwt() ->> 'email'));

-- Sekolah: semua yang sudah terdaftar boleh membaca dan menambah; mengubah
-- dibatasi ke peran sales dan admin.
create policy sekolah_lihat on sekolah for select to authenticated
  using (private.peran_saya() <> '{}');
create policy sekolah_buat on sekolah for insert to authenticated
  with check (private.punya_peran('sales', 'head_of_sales', 'admin_sales', 'admin_utama'));
create policy sekolah_ubah on sekolah for update to authenticated
  using (private.punya_peran('sales', 'head_of_sales', 'admin_sales', 'admin_utama'))
  with check (private.punya_peran('sales', 'head_of_sales', 'admin_sales', 'admin_utama'));

-- Tabel anak mengikuti izin PO induknya.
do $$
declare t text;
begin
  foreach t in array array['po_komponen', 'po_rombel', 'po_termin', 'po_catatan'] loop
    execute format($f$
      create policy %1$s_lihat on %1$s for select to authenticated
        using (exists (select 1 from po p where p.id = %1$s.po_id
                        and private.boleh_lihat_po(p.dibuat_oleh)));
      create policy %1$s_tulis on %1$s for all to authenticated
        using (exists (select 1 from po p where p.id = %1$s.po_id
                        and private.boleh_ubah_po(p.dibuat_oleh, p.status)))
        with check (exists (select 1 from po p where p.id = %1$s.po_id
                        and private.boleh_ubah_po(p.dibuat_oleh, p.status)));
    $f$, t);
  end loop;
end $$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
