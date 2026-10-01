-- Fungsinya murni regexp dan tidak menyentuh tabel apa pun, tapi search_path
-- yang bisa diubah peran pemanggil tetap jadi celah bila isinya berkembang.
create or replace function private.po_pada_jalur(nama text) returns uuid
language sql immutable set search_path to '' as $fn$
  select (regexp_match(nama,
    '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})'))[1]::uuid;
$fn$;
