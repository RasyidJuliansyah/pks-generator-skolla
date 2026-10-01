import { rp } from '@/lib/format';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penggunaHalaman, adalahLead } from '@/lib/sesi';
import { ambilDaftarSurat, type BarisSurat as Baris } from '@/lib/surat-kueri';
import { halaman } from '@/lib/paginasi';
import HalamanNav from '../halaman-nav';

export const dynamic = 'force-dynamic';

const tgl = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

const PER_HALAMAN = 20;

export default async function PenerbitanSurat({
  searchParams,
}: { searchParams: Promise<{ hal?: string }> }) {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  if (!adalahLead(hasil.pengguna.peran)) redirect('/beranda');
  const { hal } = await searchParams;

  const { totalArsip } = await ambilDaftarSurat(0, 1);
  const count = totalArsip;
  const h = halaman(count, PER_HALAMAN, hal);

  const { antrean, arsip } = await ambilDaftarSurat(h.dari, PER_HALAMAN);

  const belum = antrean.filter((p) => !p.surat_verifikasi?.final_pada);
  const sudah = arsip;

  const tabel = (baris: Baris[], kosong: string, catatanKosong: string) =>
    !baris.length ? (
      <div className="kosong"><strong>{kosong}</strong><p>{catatanKosong}</p></div>
    ) : (
      <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
        <div className="gulir">
          <table className="tabel-daftar">
            <thead>
              <tr><th>Nomor</th><th>Sekolah</th><th>Siswa</th><th>Nilai</th><th>Surat</th><th>Terverifikasi</th><th></th></tr>
            </thead>
            <tbody>
              {baris.map((p) => {
                const s = p.sekolah;
                const sr = p.surat_verifikasi;
                const keadaan = sr?.final_pada
                  ? { teks: 'Final', kelas: 'hijau' }
                  : sr?.berkas
                    ? { teks: 'Siap difinalisasi', kelas: 'kuning' }
                    : { teks: 'Belum dibuat', kelas: '' };
                return (
                  <tr key={p.id}>
                    <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                    <td>{s?.nama ?? '-'} <span className="muted">{s?.jenjang}</span></td>
                    <td>{p.jumlah_siswa}</td>
                    <td>{rp(p.grand_total)}</td>
                    <td><span className={`lencana ${keadaan.kelas}`}>{keadaan.teks}</span></td>
                    <td className="muted">{p.diverifikasi_pada ? tgl(p.diverifikasi_pada) : '-'}</td>
                    <td>
                      <Link href={`/po/${p.id}/surat`} className="preset" style={{ padding: '6px 12px' }}>
                        {sr?.final_pada ? 'Lihat surat' : sr?.berkas ? 'Finalisasi' : 'Terbitkan'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Penerbitan Surat</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Surat Verifikasi Kesiapan untuk PO yang sudah terverifikasi. Kamu
          menandatangani lalu memfinalisasi. PKS baru boleh dibuat setelah suratnya final.
          PO yang lolos verifikasi otomatis IoM tidak menunggu di sini: suratnya terbit dan
          terkunci sendiri saat PO ditutup sistem, dan langsung masuk arsip di bawah.
        </p>
      </header>

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>Menunggu diterbitkan</h2>
      {tabel(belum, 'Tidak ada yang menunggu',
        'PO yang baru selesai diverifikasi akan muncul di sini.')}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '28px 0 0' }}>
        Sudah final{count ? ` (${count})` : ''}
      </h2>
      {h.jumlah > 1 && (
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          Terbaru di atas · halaman {h.kini} dari {h.jumlah}
        </p>
      )}
      {tabel(sudah, 'Belum ada surat yang final',
        'Surat yang sudah difinalisasi tetap bisa dibuka dan dicetak dari sini.')}
      <HalamanNav h={h} taut={(x) => (x ? `/surat?hal=${x}` : '/surat')}
        label="Navigasi surat yang sudah final" />
    </main>
  );
}
