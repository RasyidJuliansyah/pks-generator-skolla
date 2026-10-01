-- Balasan pada lini masa PO (catatan/20). Tugas 1: kolom, kedalaman, pagar.
--
-- Balasan BUKAN jenis baris baru — ia baris po_komentar biasa yang membawa penambat.
-- Karena itu seluruh RLS, sunting, hapus, revisi, dan penandaan basi ikut apa adanya,
-- dan tidak ada satu pun kebijakan baru di berkas ini.
--
-- Penambatnya KUNCI SINTETIS, bukan foreign key. Alasannya ada tiga dan semuanya sudah
-- ada di kode hari ini: satu baris pks/surat menghasilkan beberapa peristiwa sehingga id
-- baris tidak cukup menunjuk peristiwa mana; tanda_tangan tidak punya kunci pengganti
-- dan BENAR-BENAR dihapus saat PO dikembalikan untuk ditandatangani ulang; dan DDL empat
-- tabel sumber tidak ada di repo ini sama sekali.
--
-- KEDUA trigger di sini ditulis sebagai GABUNGAN dengan versi di 20260910d
-- (komentar_dibaca_dan_penulis): salinan nama/peran penulis tetap diisi saat insert dan
-- tetap dipaku saat sunting, dan cek sesi tanpa email tetap berdiri. Menulis ulang trigger
-- tanpa dua penjagaan itu akan membuat SEMUA komentar baru lahir tanpa penulis.

alter table po_komentar
  add column if not exists induk_kunci text,
  add column if not exists kedalaman   integer not null default 0;

-- Balasan selalu dicari per PO, tidak pernah lintas PO.
create index if not exists po_komentar_induk on po_komentar (po_id, induk_kunci);

-- ---------------------------------------------------------------------------
-- Saat komentar atau balasan ditulis
-- ---------------------------------------------------------------------------
--
-- Ditulis ULANG UTUH, bukan ditambal: fungsi ini sudah memaku oleh/waktu/versi_po dari
-- kenyataan server, dan penjagaan c_level-nya harus tetap berdiri persis seperti semula.
-- Menyalinnya utuh membuat yang membaca migrasi ini tahu apa saja yang dijaga, tanpa
-- membuka migrasi lama.
create or replace function private.jaga_komentar_baru()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_versi        integer;
  v_nama         text;
  v_peran        peran[];
  v_saya         text := lower(auth.jwt() ->> 'email');
  v_induk_id     uuid;
  v_induk_po     uuid;
  v_induk_dalam  integer;
begin
  if v_saya is null then
    raise exception 'Sesi tidak dikenali.' using errcode = 'check_violation';
  end if;
  if 'c_level' = any (private.peran_saya()) then
    raise exception 'Peran C Level dirancang membaca seluruh alur tanpa menulis apa pun, termasuk komentar.'
      using errcode = 'check_violation';
  end if;

  select versi into v_versi from po where id = new.po_id;
  if v_versi is null then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;

  -- Salinan penulis, dari 20260910d: yang relevan adalah peran orang itu SAAT berbicara,
  -- bukan perannya sekarang. Lihat penjelasan panjang di migrasi tersebut.
  select nama, peran into v_nama, v_peran from pengguna where email = v_saya;

  new.oleh           := v_saya;
  new.nama_penulis   := v_nama;
  new.peran_penulis  := v_peran;
  new.waktu          := now();
  new.versi_po       := v_versi;
  new.disunting_pada := null;
  new.dihapus_pada   := null;
  new.dihapus_oleh   := null;

  -- Kedalaman DIHITUNG di sini, tidak pernah diambil dari kiriman klien. Klien yang
  -- mengarang kedalaman 0 pada balasan tingkat sepuluh membuat pagar di bawah tak ada
  -- artinya.
  new.kedalaman := 0;

  if new.induk_kunci is not null then
    -- Kunci terpanjang yang sah kira-kira 70 karakter (verifikasi:<fungsi>:<ISO>).
    -- Batas ini menutup penambat karangan yang dipakai menitipkan data.
    if length(new.induk_kunci) > 200 then
      raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
    end if;

    -- Hanya penambat ke KOMENTAR yang bisa diperiksa basis data. Penambat ke peristiwa
    -- lain (verifikasi:, ttd:, riwayat:, surat:, pks:) tidak punya baris yang bisa
    -- ditunjuk; kalau peristiwanya hilang, lini masa menampilkannya sebagai nisan.
    if new.induk_kunci like 'komentar:%' then
      begin
        v_induk_id := substring(new.induk_kunci from 10)::uuid;
      exception when others then
        raise exception 'Penambat balasan tidak dikenali.' using errcode = 'check_violation';
      end;

      select po_id, kedalaman into v_induk_po, v_induk_dalam
        from po_komentar where id = v_induk_id;

      if v_induk_po is null then
        raise exception 'Komentar yang dibalas tidak ditemukan.' using errcode = 'check_violation';
      end if;

      -- Balasan lintas PO tidak membocorkan apa pun (render selalu per-PO), tapi ia data
      -- sampah yang menunggu jadi kebingungan. Ditolak di sini, sekali.
      if v_induk_po <> new.po_id then
        raise exception 'Balasan harus berada di PO yang sama dengan komentar yang dibalas.'
          using errcode = 'check_violation';
      end if;

      new.kedalaman := v_induk_dalam + 1;

      -- Lima puluh tingkat bukan percakapan manusia. Pagarnya ada supaya render rekursif
      -- dan kueri rekursif punya langit-langit, bukan untuk membatasi diskusi.
      if new.kedalaman > 50 then
        raise exception 'Balasan sudah bersarang 50 tingkat. Mulai utas baru di tingkat atas.'
          using errcode = 'check_violation';
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_komentar_baru on po_komentar;
create trigger jaga_komentar_baru
  before insert on po_komentar
  for each row execute function private.jaga_komentar_baru();

-- ---------------------------------------------------------------------------
-- Saat komentar disunting
-- ---------------------------------------------------------------------------
--
-- Fungsi ini memaku kolom SATU PER SATU. Kolom baru TIDAK ikut terpaku dengan
-- sendirinya — pola yang sama dengan private.bekukan_isi_po, dan di sana kolom yang lupa
-- didaftarkan tetap bisa diubah lewat PostgREST pada PO yang sudah diteken.
--
-- induk_kunci yang bisa berubah = rantai bisa diarahkan ke keturunannya sendiri =
-- siklus. Dipaku di sini, dan itulah satu-satunya alasan tidak ada penjaga siklus
-- di mana pun: induk hanya bisa ditetapkan saat insert, jadi rantainya cuma tumbuh
-- ke arah masa lalu.
create or replace function private.jaga_komentar_sunting()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
begin
  new.id            := old.id;
  new.po_id         := old.po_id;
  new.oleh          := old.oleh;
  new.nama_penulis  := old.nama_penulis;
  new.peran_penulis := old.peran_penulis;
  new.waktu         := old.waktu;
  new.versi_po      := old.versi_po;
  new.induk_kunci   := old.induk_kunci;
  new.kedalaman     := old.kedalaman;

  if new.isi is distinct from old.isi then
    insert into po_komentar_revisi (komentar_id, isi) values (old.id, old.isi);
    new.disunting_pada := now();
  end if;

  return new;
end;
$$;

drop trigger if exists jaga_komentar_sunting on po_komentar;
create trigger jaga_komentar_sunting
  before update on po_komentar
  for each row execute function private.jaga_komentar_sunting();
