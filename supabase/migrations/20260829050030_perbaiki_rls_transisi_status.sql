-- BUG: kebijakan lama memakai `boleh_ubah_po` di WITH CHECK, yang mensyaratkan
-- status ada di ('draf','ditolak'). Pada UPDATE, USING menilai baris LAMA sedangkan
-- WITH CHECK menilai baris BARU — sehingga perpindahan draf -> menunggu_ttd selalu
-- ditolak. Akibatnya tombol "Kirim untuk ditandatangani" gagal.
--
-- Perbaikan: USING menentukan PO mana yang boleh disentuh, WITH CHECK memastikan
-- hasilnya masih berada di fase yang dikuasai sales. Urutan perpindahan yang tepat
-- tetap ditegakkan server action lewat penyaring `.eq('status', ...)`.

create or replace function private.milik_sales(pemilik text)
returns boolean language sql stable
set search_path = public
as $$
  select pemilik = lower(auth.jwt() ->> 'email')
      or private.punya_peran('head_of_sales', 'admin_sales');
$$;

drop policy if exists po_ubah on po;

create policy po_ubah on po for update to authenticated
  using (
    status in ('draf', 'ditolak', 'menunggu_ttd')
    and private.milik_sales(dibuat_oleh)
  )
  with check (
    status in ('draf', 'ditolak', 'menunggu_ttd', 'ditandatangani')
    and private.milik_sales(dibuat_oleh)
  );

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
