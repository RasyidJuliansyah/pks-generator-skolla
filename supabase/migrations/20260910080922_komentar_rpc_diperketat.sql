create or replace function sunting_komentar(p_id uuid, p_isi text)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh  text;
  v_hapus timestamptz;
  v_saya  text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select oleh, dihapus_pada into v_oleh, v_hapus from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) is distinct from v_saya then
    raise exception 'Hanya penulisnya yang bisa menyunting komentar ini.'
      using errcode = 'check_violation';
  end if;
  if v_hapus is not null then
    raise exception 'Komentar ini sudah dihapus.' using errcode = 'check_violation';
  end if;
  if length(btrim(coalesce(p_isi, ''))) = 0 then
    raise exception 'Isi komentar tidak boleh kosong.' using errcode = 'check_violation';
  end if;

  update po_komentar set isi = p_isi where id = p_id;
end;
$$;

create or replace function hapus_komentar(p_id uuid)
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_oleh text;
  v_saya text := lower(auth.jwt() ->> 'email');
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select oleh into v_oleh from po_komentar where id = p_id;
  if v_oleh is null then
    raise exception 'Komentar tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if lower(v_oleh) is distinct from v_saya then
    raise exception 'Hanya penulisnya yang bisa menghapus komentar ini.'
      using errcode = 'check_violation';
  end if;

  update po_komentar
     set dihapus_pada = now(), dihapus_oleh = v_saya
   where id = p_id and dihapus_pada is null;
end;
$$;
