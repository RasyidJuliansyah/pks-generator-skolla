import { redirect } from 'next/navigation';
import { penggunaHalaman } from '@/lib/sesi';
import { daftarJatuhTempo } from '@/lib/po-aksi';
import { BULAN_SIMPAN_TANDA_TANGAN, SEBUT_SIMPAN_TANDA_TANGAN, TIDAK_DIHAPUS } from '@/lib/retensi';
import DaftarRetensi from './daftar-retensi';

export const dynamic = 'force-dynamic';

export default async function Retensi() {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');
  if (!hasil.pengguna.peran.includes('admin_utama')) redirect('/beranda');

  const daftar = await daftarJatuhTempo();

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Pelindungan Data Pribadi</p>
        <h1>Berkas Jatuh Tempo</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, maxWidth: 680 }}>
          Gambar tanda tangan disimpan {SEBUT_SIMPAN_TANDA_TANGAN} setelah PKS
          ditandatangani basah, atau {SEBUT_SIMPAN_TANDA_TANGAN} sejak PO terakhir
          disentuh bila tidak pernah sampai PKS.{' '}
          <strong>Baris di tabel tetap disimpan</strong>: nama, waktu, dan siapa
          membubuhkan tidak ikut hilang, jadi jejak audit tidak putus. Yang dihapus hanya
          gambarnya.
        </p>
      </header>

      <div className="kotak" style={{ padding: '14px 18px', margin: '16px 0' }}>
        <p className="muted" style={{ fontSize: 13.5, margin: 0, maxWidth: 680 }}>
          <strong>Penghapusan tidak bisa dibatalkan, dan sengaja tidak otomatis.</strong>{' '}
          Tidak ada cron yang menjalankannya diam-diam, selalu ada orang yang menekan
          tombolnya dan bertanggung jawab atasnya.
        </p>
        <p className="muted" style={{ fontSize: 13.5, margin: '10px 0 0', maxWidth: 680 }}>
          Tidak pernah dihapus, dan tidak akan pernah muncul di daftar ini:{' '}
          <strong>pindaian PKS bermeterai</strong> dan <strong>pindaian PO unggahan</strong>{' '}
          ({TIDAK_DIHAPUS.join(', ')}). Keduanya dokumen perusahaan, bukan jejak proses,
          pindaian PO bahkan satu-satunya dokumen PO yang tidak bisa dibangun ulang dari
          data.
        </p>
      </div>

      <DaftarRetensi daftar={daftar} />

      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        Masa simpan {BULAN_SIMPAN_TANDA_TANGAN} bulan, satu konstanta di{' '}
        <code>lib/retensi.ts</code>, dipakai halaman ini dan perhitungan jatuh temponya.
      </p>
    </main>
  );
}
