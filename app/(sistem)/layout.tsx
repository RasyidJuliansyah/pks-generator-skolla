import { redirect } from 'next/navigation';
import {
  penggunaHalaman, LABEL_PERAN,
  adalahVerifikator, adalahLead, adalahHoO } from '@/lib/sesi';
import { komentarBelumDibaca } from '@/lib/komentar';
import PengalihTema from '@/app/tema';
import Menu, { type ItemMenu } from './menu';
import Keluar from './beranda/keluar';
import PanelSisi from './panel-sisi';

export const dynamic = 'force-dynamic';

export default async function LayoutSistem({ children }: { children: React.ReactNode }) {
  const hasil = await penggunaHalaman();
  if (hasil.status === 'anonim') redirect('/masuk');

  if (hasil.status !== 'ok') {
    const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';
    return (
      <main className="tengah">
        <div className="kartu">
          <p className="eyebrow">Skolla</p>
          <h1>Akses Belum Tersedia</h1>
          <div className="galat">
            {hasil.status === 'domain_salah'
              ? `Kamu masuk sebagai ${hasil.email}. Sistem ini hanya menerima akun @${domain}.`
              : hasil.status === 'nonaktif'
                ? `Akses untuk ${hasil.email} sudah dinonaktifkan. Hubungi Admin Utama bila ini keliru.`
                : hasil.status === 'tanpa_peran'
                  ? `${hasil.email} sudah terdaftar tapi belum diberi peran. Minta Admin Utama menetapkannya.`
                  : `${hasil.email} belum terdaftar. Minta Admin Utama menambahkan akunmu beserta perannya.`}
          </div>
          <div className="baris-kanan" style={{ marginTop: 18, justifyContent: 'center' }}>
            <PengalihTema />
            <Keluar />
          </div>
        </div>
      </main>
    );
  }

  const { pengguna } = hasil;
  // Lencana menempel di Dashboard, bukan Daftar PO: daftar di Beranda memuat SEMUA PO
  // yang punya komentar baru, sedangkan Daftar PO menyembunyikan yang sudah jadi PKS.
  // Lencana yang menunjuk ke daftar yang tidak memuat sumbernya hanya membuat orang
  // mencari-cari.
  //
  // ponytail: dihitung ulang tiap layout dirender. Layout TIDAK dirender ulang saat
  // berpindah halaman, jadi angkanya diperbarui oleh aksi server (revalidatePath) dan
  // muat ulang — bukan secara langsung. Kalau kelak perlu langsung, pakai Realtime.
  // Lencana sengaja tidak diwajibkan: kegagalan badge tidak boleh meruntuhkan seluruh aplikasi.
  let nBelum = 0;
  try {
    const belum = await komentarBelumDibaca(pengguna.email);
    nBelum = belum.reduce((a, x) => a + Number(x.jumlah), 0);
  } catch {}
  const item: ItemMenu[] = [
    { label: 'Dashboard', ke: '/beranda', ikon: 'dashboard', lencana: nBelum },
    { label: 'Analytics', ke: '/analitik', ikon: 'analitik' },
  ];
  // Menu tersendiri, bukan di bawah Analytics: ini alat pencarian per sekolah
  // yang dipakai sebelum menelepon, bukan alat analisis agregat. Ditaruh di atas
  // Daftar PO karena alurnya memang mulai dari sekolah, baru ke PO-nya.
  item.push({ label: 'Sekolah', ke: '/sekolah', ikon: 'sekolah' });
  item.push({ label: 'Daftar PO (Pre-Order)', ke: '/po', ikon: 'po' });
  // Head of Operations dan Tech Ops Lead memantau PO yang dikonfirmasi sistem dari antrean ini
  // (catatan/13a Bagian 11). Sejak penutupan otomatis, keduanya tidak lagi menutup apa pun.
  if (adalahVerifikator(pengguna.peran) || adalahHoO(pengguna.peran))
    item.push({ label: 'Antrean Verifikasi', ke: '/verifikasi', ikon: 'antrean' });
  if (adalahLead(pengguna.peran)) item.push({ label: 'Penerbitan Surat', ke: '/surat', ikon: 'surat' });
  // PKS berdiri sebagai dokumen tersendiri, bukan lampiran PO. Baris mana yang
  // terlihat tetap ditentukan RLS.
  item.push({ label: 'Perjanjian (PKS)', ke: '/pks', ikon: 'pks' });
  if (pengguna.peran.includes('admin_utama')) {
    item.push({ label: 'Kelola Pengguna', ke: '/pengguna', ikon: 'pengguna' });
    item.push({ label: 'Berkas Jatuh Tempo', ke: '/retensi', ikon: 'retensi' });
    // Gerbang ekstraksi scan (catatan/17). Rutenya sendiri, bukan tambahan di /pengguna:
    // gerbang organisasi dan catatan pembacaan adalah pekerjaan pokok halaman ini.
    item.push({ label: 'Ekstraksi', ke: '/ekstraksi', ikon: 'ekstraksi' });
  }

  return (
    <div className="kerangka">
      <PanelSisi judul="Kerjasama Sekolah">
        <div className="sisi-kepala">
          <p className="eyebrow" style={{ margin: 0 }}>Skolla</p>
          <strong>Kerjasama Sekolah</strong>
        </div>
        <Menu item={item} />
        <div className="sisi-kaki">
          <div className="sisi-akun">
            <strong>{pengguna.nama || pengguna.email}</strong>
            <span>{pengguna.peran.map((p) => LABEL_PERAN[p]).join(' · ')}</span>
          </div>
          <div className="baris-kanan">
            <PengalihTema />
            <Keluar />
          </div>
        </div>
      </PanelSisi>
      <div className="isi">{children}</div>
    </div>
  );
}
