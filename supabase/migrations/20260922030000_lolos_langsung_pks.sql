-- PO yang lolos IoM langsung berstatus terverifikasi, dan Surat Verifikasi Kesiapan-nya
-- terbit serta terkunci otomatis (keputusan Rizki 22 Sep 2026, catatan/13a Bagian 11).
--
-- Menggantikan penutupan satu-klik Head of Operations (20260917c + 20260922b). Alasannya:
-- PO yang sudah lolos seluruh aturan mesin tidak perlu menunggu satu orang menekan tombol.
-- Yang diambil alih mesin hanya LANGKAHNYA, bukan penilaiannya -- aturan yang menentukan
-- lolos tidak berubah satu pun, jadi VERSI_IOM sengaja TIDAK naik (preseden Bagian 10,
-- yang juga cuma mengubah siapa yang boleh menutup).
--
-- Gerbang PKS sengaja TIDAK disentuh. `buat_pks` tetap menuntut status `terverifikasi` +
-- Surat final; bedanya Surat itu kini sudah final begitu PO masuk, jadi gerbangnya selalu
-- terpenuhi tanpa pengecualian baru di sana.
--
-- Yang dikorbankan, dan disadari: tidak ada lagi mata manusia di jalur otomatis. Verdict
-- mesin menjadi satu-satunya otoritas atas dokumen yang berujung kontrak. Penangkal yang
-- tersisa: verdict fail-closed (`galat-evaluasi`), deklarasi kesiapan yang kedaluwarsa
-- 17 Mar 2027, dan aturan `tanpa-diskon` / `sponsorship-dalam-batas` /
-- `tanpa-permintaan-tambahan` yang melempar PO menyimpang ke antrean empat fungsi.
--
-- Surat otomatis menyatakan SISTEM yang mengkonfirmasi menurut ketentuan IoM yang berlaku,
-- dan menyebut Head of Operations + Tech Ops Lead sebagai pihak yang DIINFORMASIKAN --
-- bukan sebagai penanda tangan. Karena itu surat seperti ini tidak punya tanda tangan
-- gambar, dan kolom penandanya dikosongkan (lihat batasan surat_penanda_konsisten).
--
-- SIFAT YANG DIPILIH: gagal keras. Penutupan dipanggil trigger dari DALAM transaksi
-- pengajuan verifikasi Sales, dan `catat_verdict_iom` menulis verdictnya di LUAR blok
-- `exception when others`-nya, jadi galat di sini tidak tertelan: pengajuan verifikasinya
-- ikut batal dan Sales melihat pesannya. Tidak ada keadaan "lolos tapi menggantung" yang
-- tak bisa ditutup siapa pun -- itu justru temuan QA 3a putaran 2.

-- ---------------------------------------------------------------------------
-- 1. Kolom penanda, dan surat yang boleh dikunci basis data
-- ---------------------------------------------------------------------------
-- Penanda yang tahan waktu, dan sengaja BUKAN diturunkan dari verifikasi_otomatis saat
-- dibaca: PO yang direvisi sesudah lulus akan kehilangan jejak bahwa penutupannya otomatis.
alter table po add column if not exists diverifikasi_otomatis boolean not null default false;

comment on column po.diverifikasi_otomatis is
  'Ditutup lewat jalur IoM otomatis, tanpa klik manusia. Tahan waktu: revisi sesudahnya tidak menghapus jejak ini.';

-- Komentar lama (20260829072645) menyebut kolom ini sebagai nama orang yang menutup, dan sejak
-- penutupan otomatis ia sengaja dikosongkan. Komentar basis data yang salah lebih berbahaya
-- daripada tidak ada komentar: ia yang dibaca orang berikutnya.
comment on column po.diverifikasi_oleh is
  'Orang yang MENUTUP verifikasi: Tech Ops Lead pada jalur manual, atau HoO pada penutupan satu-klik lama. KOSONG untuk penutupan otomatis (sejak 22 Sep 2026) -- kolomnya ber-foreign key ke pengguna(email) dan memang tidak ada orang yang menutupnya. Penanda otomatisnya ada di po.diverifikasi_otomatis.';

alter table surat_verifikasi add column if not exists otomatis boolean not null default false;

comment on column surat_verifikasi.otomatis is
  'Diterbitkan dan dikunci basis data, tanpa tanda tangan manusia. ditandatangani_oleh dan nama_penanda NULL.';

-- Surat otomatis tidak punya penanda tangan, jadi kedua kolom itu harus boleh kosong.
-- Kelonggaran ini dijaga batasan di bawah supaya jalur manual tetap seketat sebelumnya.
alter table surat_verifikasi alter column ditandatangani_oleh drop not null;
alter table surat_verifikasi alter column nama_penanda drop not null;

alter table surat_verifikasi drop constraint if exists surat_penanda_konsisten;
alter table surat_verifikasi add constraint surat_penanda_konsisten check (
  (otomatis and ditandatangani_oleh is null and nama_penanda is null)
  or (not otomatis and ditandatangani_oleh is not null and nama_penanda is not null));

-- Kebijakan surat diperketat: klien tidak boleh membuat atau menyentuh surat bertanda
-- otomatis. Tanpa `not otomatis`, seorang Tech Ops Lead bisa menyisipkan surat "otomatis"
-- lewat PostgREST dan melewati gerbang PKS tanpa satu pun keputusan fungsi.
drop policy if exists surat_terbit on surat_verifikasi;
create policy surat_terbit on surat_verifikasi for insert to authenticated
  with check (
    private.punya_peran('tech_ops_lead')
    and not otomatis
    and ditandatangani_oleh = lower(auth.jwt() ->> 'email')
    and final_pada is null
    and exists (select 1 from po p
                 where p.id = surat_verifikasi.po_id and p.status = 'terverifikasi'));

-- USING menilai baris lama: surat yang sudah final tidak bisa disentuh lagi.
drop policy if exists surat_sunting on surat_verifikasi;
create policy surat_sunting on surat_verifikasi for update to authenticated
  using (private.punya_peran('tech_ops_lead') and final_pada is null and not otomatis)
  with check (private.punya_peran('tech_ops_lead') and not otomatis
    and ditandatangani_oleh = lower(auth.jwt() ->> 'email'));

drop policy if exists surat_batal on surat_verifikasi;
create policy surat_batal on surat_verifikasi for delete to authenticated
  using (private.punya_peran('tech_ops_lead') and final_pada is null and not otomatis);

-- ---------------------------------------------------------------------------
-- 1b. PO baru SELALU lahir sebagai draf
-- ---------------------------------------------------------------------------
-- DUA hal, dan yang kedua itulah yang sebenarnya terbuka.
--
-- Status 'terverifikasi' pada INSERT sudah ditolak `private.jaga_lantai_po` sejak 9 Sep 2026
-- ('PO baru harus berstatus draf'), jadi baris di bawah BUKAN penambal lubang itu. Yang belum
-- dijaga siapa pun adalah `diverifikasi_otomatis` pada PO yang lahir sebagai draf: sebuah PO
-- tanpa satu pun putusan fungsi bisa mengaku lolos otomatis, lalu muncul di daftar
-- "Terverifikasi otomatis IoM" yang justru dipakai HoO dan Tech Ops Lead untuk mengawasi.
-- Yang menutup itu `po_jaga_penanda` (bagian 4b); syarat status di sini lapis kedua saja,
-- supaya kelahiran PO punya satu tempat yang jelas.
--
-- Tidak memutus apa pun yang sah: satu-satunya pembuat PO di aplikasi (`simpanDraf`) tidak
-- pernah menyetel status, jadi default 'draf' selalu memenuhi.
drop policy if exists po_buat on po;
create policy po_buat on po for insert to authenticated
  with check (
    dibuat_oleh = lower(auth.jwt() ->> 'email')
    and private.punya_peran('sales', 'head_of_sales', 'admin_sales')
    and status = 'draf'
  );

-- ---------------------------------------------------------------------------
-- 2. Backfill: PO lama yang ditutup HoO lewat jalur IoM, tetapi suratnya belum pernah terbit
-- ---------------------------------------------------------------------------
-- Dikerjakan SEBELUM penjaga penutupan diganti, mengikuti pola yang sama dengan
-- 20260830b ("backfill lebih dulu, selagi trigger pembekuan belum mengenal kolomnya").
-- Penandanya disetel juga supaya berkas ini tetap aman dijalankan ulang.
--
-- Tanpa backfill ini, PO tersebut tetap macet: statusnya terverifikasi, tetapi tidak punya
-- surat final sehingga `buat_pks` menolaknya selamanya.
select set_config('app.penutup_iom', '1', true);

insert into surat_verifikasi (po_id, otomatis)
select p.id, true from po p
 where p.status = 'terverifikasi'
   and not p.diverifikasi_otomatis
   and exists (
     select 1 from (select lolos from verifikasi_otomatis
                     where po_id = p.id order by dicatat_pada desc limit 1) t
      where t.lolos)
   and (select count(*) from verifikasi v
         where v.po_id = p.id and v.berlaku and v.hasil <> 'tolak') < 4
   and not exists (select 1 from surat_verifikasi s where s.po_id = p.id)
on conflict (po_id) do nothing;

update surat_verifikasi s set final_pada = now()
 where s.otomatis and s.final_pada is null
   and exists (select 1 from po p where p.id = s.po_id and p.status = 'terverifikasi');

update po p set diverifikasi_otomatis = true
 where p.status = 'terverifikasi' and not p.diverifikasi_otomatis
   and exists (select 1 from surat_verifikasi s where s.po_id = p.id and s.otomatis);

-- ---------------------------------------------------------------------------
-- 3. Penutupan otomatis + penerbitan suratnya
-- ---------------------------------------------------------------------------
-- Satu-satunya jalan masuk ke jalur IoM penutupan. Dipanggil trigger di bawah, tidak
-- diekspos sebagai RPC: tidak ada lagi yang perlu memanggilnya dari aplikasi.
create or replace function private.tutup_otomatis(p_po uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from po where id = p_po for update;
  if not found then
    raise exception 'PO tidak ditemukan.' using errcode = 'check_violation';
  end if;
  if v_status <> 'verifikasi' then
    raise exception 'PO tidak sedang dalam tahap verifikasi.' using errcode = 'check_violation';
  end if;

  -- Penanda transaksi. Ia satu-satunya yang membuat trigger penutupan mengizinkan jalur
  -- IoM tanpa peran Head of Operations. `is_local = true`, jadi tidak menempel di koneksi
  -- yang dipakai bersama oleh connection pool PostgREST.
  perform set_config('app.penutup_iom', '1', true);

  -- `diverifikasi_oleh` sengaja DIKOSONGKAN, dan itu bukan kelalaian.
  --
  -- Dua alasan, keduanya mengikat. Pertama, kolom itu ber-FOREIGN KEY ke pengguna(email)
  -- (20260829072645_catat_penutup_verifikasi), jadi nilai apa pun yang bukan email DITOLAK --
  -- dan penolakan itu terjadi di dalam transaksi pengajuan verifikasi Sales, sehingga SELURUH
  -- pengajuan ikut batal. Percobaan pertama migrasi ini menulis 'sistem:iom-<versi>' dan
  -- karenanya tidak akan pernah berhasil pada satu PO pun. Kedua, catatan/13a Bagian 6
  -- memutuskan kolom ini berisi NAMA ORANG; mengisinya dengan penanda sistem akan tercetak
  -- sebagai nama di dokumen.
  --
  -- Yang mencatat bahwa penutupan ini otomatis adalah `diverifikasi_otomatis`, dan versi
  -- aturannya ada di baris `verifikasi_otomatis.versi_iom`. Keduanya sudah cukup, dan
  -- keduanya jujur: memang tidak ada orang yang menutup PO ini.
  update po set status = 'terverifikasi',
                diverifikasi_oleh = null,
                diverifikasi_pada = now(),
                diverifikasi_otomatis = true
   where id = p_po;

  -- Surat terbit dan langsung terkunci. Tanpa tanda tangan gambar, tanpa penanda: suratnya
  -- menyatakan sistem yang mengkonfirmasi, bukan orang.
  insert into surat_verifikasi (po_id, otomatis) values (p_po, true)
    on conflict (po_id) do nothing;

  update surat_verifikasi set final_pada = now()
   where po_id = p_po and otomatis and final_pada is null;
end $$;

revoke all on function private.tutup_otomatis(uuid) from public, anon, authenticated;

create or replace function private.tutup_otomatis_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform private.tutup_otomatis(new.po_id);
  return null;
end $$;

revoke all on function private.tutup_otomatis_trigger() from public, anon, authenticated;

-- AFTER INSERT, bukan dipanggil dari catat_verdict_iom(): pemisahannya jelas -- pencatat
-- verdict hanya mencatat, yang memutuskan penutupan adalah verdictnya sendiri. Verdict
-- gagal tidak memicu apa pun, jadi PO tetap di `verifikasi` untuk keempat fungsi.
drop trigger if exists po_tutup_otomatis on verifikasi_otomatis;
create trigger po_tutup_otomatis after insert on verifikasi_otomatis
  for each row when (new.lolos) execute function private.tutup_otomatis_trigger();

-- ---------------------------------------------------------------------------
-- 4. Penjaga penutupan: jalur IoM berpindah dari peran HoO ke penanda transaksi
-- ---------------------------------------------------------------------------
-- Sisa badan disalin apa adanya dari definisi hidup 22 Sep 2026. Yang berubah cuma SATU:
-- syarat peran HoO diganti penanda transaksi. (Penjagaan kolom penanda hidup di trigger
-- tersendiri, bagian 4b, dan itu disengaja.) Seluruh syarat substantifnya TETAP: nol
-- penolakan, verdict terakhir lolos untuk versi PO ini dan versi IoM yang berlaku, dan
-- deklarasi tiap paket yang dipakai masih berlaku.
create or replace function private.jaga_penutupan_verifikasi()
returns trigger language plpgsql set search_path = public
as $$
declare hijau int; tolak int;
begin
  if OLD.status <> 'verifikasi' or NEW.status = OLD.status then return NEW; end if;
  select count(*) filter (where hasil <> 'tolak'), count(*) filter (where hasil = 'tolak')
    into hijau, tolak from verifikasi where po_id = NEW.id and berlaku;
  if NEW.status = 'terverifikasi' and (hijau < 4 or tolak > 0) then
    -- Jalur IoM: tanpa empat persetujuan, tanpa satu pun penolakan, dan verdict TERAKHIR
    -- lolos untuk versi PO ini dan versi IoM yang berlaku.
    --
    -- Yang berhak menempuh jalur ini kini bukan peran, melainkan PENANDA TRANSAKSI yang
    -- hanya dipasang private.tutup_otomatis(). Peran diperiksa harfiah lewat peran_saya()
    -- pada versi sebelumnya, bukan punya_peran(): punya_peran meloloskan admin_utama untuk
    -- peran apa pun (temuan QA putaran 1), padahal keputusannya "hanya Head of Operations".
    -- Sejak keputusan 22 Sep 2026 keputusan itu pindah ke mesin, jadi perannya tidak lagi
    -- relevan -- yang relevan tinggal siapa yang boleh memasang penandanya.
    --
    -- Deklarasi paketnya diperiksa ulang saat menutup. Sejak PO berkelompok boleh otomatis,
    -- jadi SETIAP paket yang dipakai diperiksa, bukan cuma satu.
    if tolak > 0
       or coalesce(current_setting('app.penutup_iom', true), '') <> '1'
       or not exists (
         select 1 from (select lolos, versi_po, versi_iom, paket, kelompok from verifikasi_otomatis
                         where po_id = NEW.id order by dicatat_pada desc limit 1) t
          where t.lolos and t.versi_po = NEW.versi and t.versi_iom = private.versi_iom_berlaku()
            and cardinality(coalesce(t.kelompok, array[t.paket])) > 0
            and not exists (
              select 1 from unnest(coalesce(t.kelompok, array[t.paket])) pk
               where not exists (
                 select 1 from (select berlaku_sampai, butir from deklarasi_kesiapan dk
                                 where dk.produk = pk order by dk.ditandatangani_pada desc limit 1) d
                  where d.berlaku_sampai >= (now() at time zone 'Asia/Jakarta')::date
                    and d.butir @> array['a1','a2','a3','b1','b2','b3','c2','d3','e3','e4'])))
    then
      raise exception 'Belum bisa dinyatakan terverifikasi: % dari 4 fungsi setuju, % menolak.', hijau, tolak;
    end if;
  end if;
  if NEW.status = 'ditolak' and tolak = 0 then
    raise exception 'Tidak ada fungsi yang menolak, jadi PO ini tidak bisa ditutup sebagai ditolak.';
  end if;
  return NEW;
end $$;

revoke all on function private.jaga_penutupan_verifikasi() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4b. Kolom penanda hanya boleh diisi private.tutup_otomatis()
-- ---------------------------------------------------------------------------
-- Trigger TERSENDIRI, dan `before insert or update`. Awalnya pemeriksaan ini menumpang di
-- `jaga_penutupan_verifikasi`, yang hanya berjalan pada UPDATE — sehingga sebuah PO yang
-- DISISIPKAN dengan `status='terverifikasi', diverifikasi_otomatis=true` lolos begitu saja dan
-- langsung tampil di daftar pengawasan HoO. Pemisahan ini juga menjaga fungsi penutupan tetap
-- soal penutupan saja.
create or replace function private.jaga_penanda_otomatis()
returns trigger language plpgsql set search_path = public
as $$
begin
  -- Tanpa penanda transaksi, kolom ini tidak boleh berubah dari keadaan sebelumnya. Pada
  -- INSERT, OLD null diperlakukan sebagai false, sehingga `true` tetap ditolak.
  if NEW.diverifikasi_otomatis is distinct from coalesce(OLD.diverifikasi_otomatis, false)
     and coalesce(current_setting('app.penutup_iom', true), '') <> '1' then
    raise exception 'Penanda verifikasi otomatis hanya boleh diisi basis data.'
      using errcode = 'check_violation';
  end if;
  return NEW;
end $$;

revoke all on function private.jaga_penanda_otomatis() from public, anon, authenticated;

drop trigger if exists po_jaga_penanda on po;
create trigger po_jaga_penanda before insert or update on po
  for each row execute function private.jaga_penanda_otomatis();

-- ---------------------------------------------------------------------------
-- 5. Sidik pindaian: kolom verifikasi tetap di luar sidik
-- ---------------------------------------------------------------------------
-- Sejak PO berkelompok (20260912) sidik dihitung dari isi PO. `diverifikasi_otomatis`
-- adalah metadata verifikasi, sama seperti `diverifikasi_oleh` yang sudah dikecualikan.
-- Menambahkannya ke sini bukan karena ada jalur yang memburunya hari ini, melainkan supaya
-- PO unggahan tidak suatu hari ditolak "isinya berubah" hanya karena ia lolos otomatis.
-- Badan fungsi disalin APA ADANYA dari definisi hidup 20260912; satu-satunya perubahan
-- adalah menambahkan `'diverifikasi_otomatis'` ke daftar kolom yang dikecualikan. Menyalin
-- ulang fungsi ini dari ingatan berbahaya: sidik yang berbeda sedikit membuat SEMUA PO
-- unggahan ditolak "isinya berubah", dan galatnya tidak menunjuk ke sini.
create or replace function private.sidik_tinjauan(p po)
returns text
language sql
stable
security definer
set search_path to public
as $$
  select encode(sha256(convert_to(jsonb_build_object(
    'po', (to_jsonb(p) - array['nomor', 'status', 'versi', 'dibuat_oleh', 'dibuat_pada',
                               'diubah_pada', 'diverifikasi_oleh', 'diverifikasi_pada',
                               'diverifikasi_otomatis', 'versi_pricelist', 'sekolah_beku',
                               'ditinjau_pada', 'ditinjau_oleh', 'ditinjau_sidik']),
    'sekolah', coalesce(p.sekolah_beku, '{}'::jsonb) - 'dipegang_oleh',
    'komponen', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_komponen x where x.po_id = p.id),
    'rombel',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_rombel x where x.po_id = p.id),
    'termin',   (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_termin x where x.po_id = p.id),
    'catatan',  (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_catatan x where x.po_id = p.id),
    'kelompok', (select coalesce(jsonb_agg(to_jsonb(x) - 'po_id' order by (to_jsonb(x) - 'po_id')::text), '[]')
                   from po_kelompok x where x.po_id = p.id),
    'pindaian', (select jsonb_build_object('versi', o.version, 'etag', o.metadata->>'eTag')
                   from storage.objects o
                  where o.bucket_id = 'po-unggahan' and o.name = p.berkas_unggahan
                    and o.archived_at is null)
  )::text, 'UTF8')), 'hex');
$$;

revoke all on function private.sidik_tinjauan(po) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Jalan HoO dicabut
-- ---------------------------------------------------------------------------
-- Tidak dibiarkan menganggur: RPC yang bisa memindahkan PO ke terverifikasi tanpa lagi
-- dipakai aplikasi adalah jalur penutupan kedua yang tidak punya alasan hidup.
drop function if exists public.tutup_verifikasi_otomatis(uuid);
