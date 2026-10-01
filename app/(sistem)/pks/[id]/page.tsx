import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { penggunaHalaman, bolehBuatPo } from '@/lib/sesi';
import { ambilDetailPo } from '@/lib/po-kueri';
import { satu } from '@/lib/relasi';
import { dokumenPks } from '@/lib/dokumen-pks';
import { dataPksDariPo, sekolahDokumen } from '@/lib/dokumen-dari-po';
import PanelPks from './panel-pks';
import { ekorNomor } from '@/lib/nomor-pks';
import { urlPksBasah } from '@/lib/pks-aksi';
import UnggahBasah from './unggah-basah';
import KertasPks from './kertas-pks';
import DokumenSponsorship from './dokumen-sponsorship';
import { adaSponsorship, konfirmasiBeres, type KonfirmasiSponsorship } from '@/lib/sponsorship';

export const dynamic = 'force-dynamic';

export default async function HalamanPks({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');

  const po = await ambilDetailPo(id, hasil.pengguna.email, hasil.pengguna.peran);
  if (!po) notFound();

  const suratFinal = !!satu<{ final_pada: string | null }>(po.surat_verifikasi)?.final_pada;
  const pks = satu<{
    tahun: number; bulan: number; final_pada: string | null;
    berkas_basah: string | null; diunggah_oleh: string | null; ditandatangani_pada: string | null;
  }>(po.pks);

  // Gerbangnya diperiksa lagi di basis data saat draf dibuat; ini hanya penjelasan.
  if (!suratFinal && !pks) {
    return (
      <main className="wrap">
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>PKS Belum Bisa Dibuat</h1>
        <div className="kosong" style={{ marginTop: 16 }}>
          <strong>Surat Verifikasi Kesiapan belum final</strong>
          <p>
            PKS baru boleh disusun setelah Tech Ops Lead menandatangani dan memfinalisasi
            Surat Verifikasi Kesiapan. Status PO sekarang: {po.status.replace(/_/g, ' ')}.
          </p>
        </div>
        <div className="ttd-aksi">
          <Link href={`/po/${id}`} className="preset">Kembali ke PO</Link>
          {po.status === 'terverifikasi' && (
            <Link href={`/po/${id}/surat`} className="tombol" style={{ width: 'auto', margin: 0 }}>
              Buka Surat Verifikasi Kesiapan
            </Link>
          )}
        </div>
      </main>
    );
  }

  const bisaKelola = bolehBuatPo(hasil.pengguna.peran) &&
    (po.dibuat_oleh === hasil.pengguna.email ||
      hasil.pengguna.peran.some((r) => r === 'head_of_sales' || r === 'admin_sales'));

  // Angka urut nomor perjanjian diisi tangan; yang dihasilkan hanya ekornya.
  // Sebelum draf dibuat, bulan dan tahunnya diambil dari hari ini sebagai
  // gambaran — nilai yang tersimpan baru ditetapkan saat draf dibuat.
  // PO bersponsorship: punya catatan sponsorship berisi ATAU nilainya diisi. PO lama tanpa
  // nilai tetap wajib dikonfirmasi dokumennya (catatan/18). Syaratnya tinggal di
  // lib/sponsorship.ts supaya halaman ini, halaman PO, dan daftar PKS tidak menyimpang.
  const bersponsorship = adaSponsorship(po);
  const konfirmasiSp = satu<KonfirmasiSponsorship>(po.pks_dokumen_sponsorship) ?? null;
  const sponsorshipBeres = konfirmasiBeres(konfirmasiSp, po.versi);
  // Peran finance HARFIAH, sama dengan kebijakan RLS-nya. punya_peran meloloskan Super Admin
  // untuk peran apa pun, dan butir ini milik Finance.
  const adalahFinance = hasil.pengguna.peran.includes('finance');

  const urlBasah = pks?.berkas_basah ? await urlPksBasah(pks.berkas_basah) : null;
  const kini = new Date();
  const html = dokumenPks(dataPksDariPo(po, ekorNomor(
    pks?.bulan ?? kini.getMonth() + 1,
    pks?.tahun ?? kini.getFullYear(),
  )));

  return (
    <main className="wrap">
      <header className="no-print" style={{ marginBottom: 4 }}>
        <p className="eyebrow">PO-{String(po.nomor).padStart(3, '0')}</p>
        <h1>Perjanjian Kerja Sama</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>{sekolahDokumen(po).nama}</p>
      </header>

      <PanelPks
        poId={po.id}
        adaDraf={!!pks}
        finalPada={pks?.final_pada ?? null}
        bisaKelola={bisaKelola}
      />

      {bersponsorship && (
        <DokumenSponsorship
          poId={po.id}
          versiPo={po.versi}
          konfirmasi={konfirmasiSp}
          adalahFinance={adalahFinance}
        />
      )}

      {pks?.final_pada && bisaKelola && (
        <UnggahBasah
          tertahanSponsorship={bersponsorship && !sponsorshipBeres}
          poId={po.id}
          sudahAda={!!pks.berkas_basah}
          urlBerkas={urlBasah}
          tanggal={pks.ditandatangani_pada
            ? new Date(pks.ditandatangani_pada).toLocaleDateString('id-ID',
                { day: 'numeric', month: 'long', year: 'numeric' })
            : null}
          diunggahOleh={pks.diunggah_oleh?.split('@')[0] ?? null}
        />
      )}

      <section className="pks-dokumen">
        <KertasPks html={html} />
      </section>
    </main>
  );
}
