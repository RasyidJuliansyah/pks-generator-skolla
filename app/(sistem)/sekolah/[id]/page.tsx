import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { penggunaHalaman } from '@/lib/sesi';
import { ambilDetailSekolah } from '@/lib/sekolah-kueri';
import { rp } from '@/lib/format';
import { type SumberLiniMasa } from '@/lib/lini-masa';
import RiwayatKerjaSama from './riwayat-kerja-sama';
import { TAHAP_PO, TAHAP_PKS, URUTAN_TAHAP } from '@/lib/status-po';

export const dynamic = 'force-dynamic';

const LABEL = Object.fromEntries([...TAHAP_PO, ...TAHAP_PKS].map((s) => [s.kode, s]));
const tgl = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';

/**
 * Riwayat satu sekolah: seluruh PO yang pernah dibuat untuknya, lintas tahun,
 * berikut status dan PKS masing-masing.
 *
 * Data sekolahnya diambil dari baris HIDUP — halaman ini memang tentang sekolah
 * sebagai mitra, bukan tentang satu dokumen. Yang tercetak di tiap PO tetap
 * salinan bekunya, dan keduanya bisa berbeda kalau datanya pernah dibetulkan.
 */
export default async function RiwayatSekolah({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');

  const baris = await ambilDetailSekolah(id, hasil.pengguna.email, hasil.pengguna.peran);
  if (!baris) notFound();

  type BarisPo = {
    id: string; nomor: number; status: string; grand_total: number;
    jumlah_siswa: number; jumlah_guru: number;
    masa_mulai: string | null; masa_selesai: string | null;
    dibuat_oleh: string; dibuat_pada: string; diverifikasi_oleh: string | null;
    /** Ditutup basis data, bukan oleh orang. Lihat catatan/13a Bagian 11. */
    diverifikasi_otomatis: boolean;
    po_riwayat: SumberLiniMasa['riwayat'];
    tanda_tangan: SumberLiniMasa['ttd'];
    verifikasi: SumberLiniMasa['verifikasi'];
    surat_verifikasi: SumberLiniMasa['surat'];
    pks: (SumberLiniMasa['pks'] & { ditandatangani_pada: string | null }) | null;
  };
  const sekolah = baris as unknown as {
    nama: string; npsn: string | null; jenjang: string; alamat: string | null;
    kepala_sekolah: string | null; kepsek_hp: string | null;
    bendahara: string | null; bendahara_hp: string | null;
    dipegang_oleh: string | null; po: BarisPo[] | null;
  };
  const po = (sekolah.po ?? []).slice()
    .sort((a, b) => b.nomor - a.nomor);

  const nilaiTotal = po.reduce((a, p) => a + (p.grand_total || 0), 0);
  const jadi = po.filter((p) =>
    URUTAN_TAHAP.indexOf(p.status) >= URUTAN_TAHAP.indexOf('pks_terbit')).length;
  const ditolak = po.filter((p) => p.status === 'ditolak').length;

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">
            <Link href="/sekolah">Sekolah</Link>
          </p>
          <h1>{sekolah.nama}</h1>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
            {sekolah.jenjang}
            {sekolah.npsn ? ` · NPSN ${sekolah.npsn}` : ''}
            {sekolah.dipegang_oleh ? ` · dipegang ${sekolah.dipegang_oleh.split('@')[0]}` : ''}
          </p>
        </div>
      </header>

      <div className="kpi">
        {[
          { label: 'PO seumur hidup', nilai: String(po.length) },
          { label: 'Jadi PKS', nilai: String(jadi) },
          { label: 'Ditolak', nilai: String(ditolak) },
          { label: 'Nilai seluruhnya', nilai: rp(nilaiTotal) },
        ].map((k) => (
          <div className="kpi-kotak" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-angka${k.nilai === '0' || k.nilai === 'Rp0' ? ' kpi-kosong' : ''}`}>
              {k.nilai}
            </div>
          </div>
        ))}
      </div>

      <section className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head"><h2>Kontak</h2></div>
        <div className="sekolah-kisi" style={{ marginTop: 10 }}>
          <div>
            <div className="kpi-label">Kepala Sekolah</div>
            <div>{sekolah.kepala_sekolah || '-'}</div>
            <div className="ttd-waktu">{sekolah.kepsek_hp || 'nomor belum diisi'}</div>
          </div>
          <div>
            <div className="kpi-label">Bendahara</div>
            <div>{sekolah.bendahara || '-'}</div>
            <div className="ttd-waktu">{sekolah.bendahara_hp || 'nomor belum diisi'}</div>
          </div>
          <div>
            <div className="kpi-label">Alamat</div>
            <div style={{ fontSize: 13.5 }}>{sekolah.alamat || '-'}</div>
          </div>
        </div>
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Riwayat Kerja Sama</h2>
        <p className="muted" style={{ margin: '4px 0 14px', fontSize: 13.5 }}>
          Seluruh PO untuk sekolah ini, terbaru di atas. PO yang sudah jadi PKS
          tetap tercantum, di sinilah riwayat perpanjangan terbaca.
        </p>
        {!po.length ? (
          <div className="kosong">
            <strong>Belum ada PO</strong>
            <p>Sekolah ini tercatat tapi belum pernah dibuatkan Pre-Order.</p>
          </div>
        ) : (
          <RiwayatKerjaSama po={po} />
        )}
      </section>
    </main>
  );
}
