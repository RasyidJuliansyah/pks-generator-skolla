import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { penggunaHalaman, daftarPengguna, adalahLead } from '@/lib/sesi';
import { ambilDetailPo } from '@/lib/po-kueri';
import { satu } from '@/lib/relasi';
import { SETELAH_VERIFIKASI } from '@/lib/status-po';
import { urlTtd } from '@/lib/po-aksi';
import { dokumenSurat } from '@/lib/dokumen-surat';
import { dataSuratDariPo, sekolahDokumen } from '@/lib/dokumen-dari-po';
import { verdictTerakhir } from '@/lib/verdict-iom';
import PanelSurat from './panel-surat';

export const dynamic = 'force-dynamic';

export default async function SuratVerifikasi({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');

  const po = await ambilDetailPo(id, hasil.pengguna.email, hasil.pengguna.peran);
  if (!po) notFound();

  const bolehTtdSurat = adalahLead(hasil.pengguna.peran);

  if (!SETELAH_VERIFIKASI.includes(po.status)) {
    return (
      <main className="wrap">
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>Surat Belum Bisa Diterbitkan</h1>
        <div className="kosong" style={{ marginTop: 16 }}>
          <strong>PO ini belum terverifikasi</strong>
          <p>
            Surat terbit setelah keempat fungsi memberi keputusan dan Tech Ops Lead
            menutup tahap verifikasi. Status sekarang: {po.status.replace(/_/g, ' ')}.
          </p>
        </div>
        <Link href={`/po/${id}`} className="preset" style={{ marginTop: 16, display: 'inline-block' }}>
          Kembali ke PO
        </Link>
      </main>
    );
  }

  const surat = satu<{
    nama_penanda: string | null; berkas: string | null; final_pada: string | null; otomatis: boolean | null;
  }>(po.surat_verifikasi);

  // Surat yang diterbitkan basis data sendiri (private.tutup_otomatis) tidak punya penanda
  // tangan, jadi rantai nama di bawah tidak berlaku untuknya.
  const otomatis = !!surat?.otomatis;
  const versiIom = verdictTerakhir(
    (po.verifikasi_otomatis ?? []) as { versi_iom: string; dicatat_pada: string }[])?.versi_iom;

  // Nama penanda tangan diambil dari surat bila sudah ada; selama belum
  // ditandatangani, yang ditampilkan adalah Tech Ops Lead yang menutup
  // verifikasi. Dicari lewat daftarPengguna(), bukan membaca tabel `pengguna`
  // langsung: barisnya milik orang lain, dan tabel itu hanya boleh dibaca Admin
  // Utama serta pemilik barisnya sendiri.
  const penutup = po.diverifikasi_oleh
    ? (await daftarPengguna()).find((u) => u.email === po.diverifikasi_oleh)
    : undefined;
  const namaLead = otomatis
    ? 'Sistem Skolla'
    : surat?.nama_penanda
      || penutup?.nama || po.diverifikasi_oleh
      || (bolehTtdSurat ? (hasil.pengguna.nama || hasil.pengguna.email) : '-');

  const ttdUrl = surat?.berkas ? await urlTtd(surat.berkas) : null;
  const html = dokumenSurat(
    dataSuratDariPo(po, po.verifikasi ?? [], namaLead, ttdUrl ?? undefined, versiIom ?? undefined)
  );

  return (
    <main className="wrap">
      <header className="no-print" style={{ marginBottom: 4 }}>
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>Surat Verifikasi Kesiapan</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>{sekolahDokumen(po).nama}</p>
      </header>

      <PanelSurat
        poId={po.id}
        namaLead={namaLead}
        sudahTtd={!!surat?.berkas}
        finalPada={surat?.final_pada ?? null}
        otomatis={otomatis}
        versiIom={versiIom ?? null}
        adalahLead={bolehTtdSurat}
      />

      <section className="po-dokumen">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </section>
    </main>
  );
}
