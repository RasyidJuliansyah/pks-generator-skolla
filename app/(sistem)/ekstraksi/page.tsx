import { redirect } from 'next/navigation';
import Link from 'next/link';
import { penggunaHalaman, adalahSuperAdmin } from '@/lib/sesi';
import prisma from '@/lib/prisma';
import Gerbang, { BukaHasil } from './gerbang';

export const dynamic = 'force-dynamic';

const JUMLAH_RIWAYAT = 20;
const JUMLAH_PEMBACAAN = 50;

const waktu = (t: string | Date | null) =>
  t ? new Date(t).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export default async function Ekstraksi() {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  if (!adalahSuperAdmin(hasil.pengguna.peran)) redirect('/beranda');

  const gerbang = await prisma.pengaturanEkstraksi.findFirst({
    orderBy: { id: 'desc' },
  });

  const riwayatRaw = await prisma.pengaturanEkstraksi.findMany({
    select: {
      id: true,
      menyala: true,
      penyedia: true,
      model: true,
      risikoDiterimaOleh: true,
      diubahOleh: true,
      diubahPada: true,
    },
    orderBy: { id: 'desc' },
    take: JUMLAH_RIWAYAT,
  });

  const riwayat = riwayatRaw.map((r) => ({
    id: String(r.id),
    menyala: r.menyala,
    penyedia: r.penyedia,
    model: r.model,
    risiko_diterima_oleh: r.risikoDiterimaOleh,
    diubah_oleh: r.diubahOleh,
    diubah_pada: r.diubahPada.toISOString(),
  }));

  const pembacaanRaw = await prisma.ekstraksiPo.findMany({
    select: {
      id: true,
      poId: true,
      diklaimOleh: true,
      diklaimPada: true,
      selesaiPada: true,
      durasiMs: true,
      berhasil: true,
      galat: true,
      tokenMasuk: true,
      tokenKeluar: true,
      po: {
        select: { nomor: true },
      },
    },
    orderBy: { diklaimPada: 'desc' },
    take: JUMLAH_PEMBACAAN,
  });

  const pembacaan = pembacaanRaw.map((r) => ({
    id: r.id,
    po_id: r.poId,
    diklaim_oleh: r.diklaimOleh,
    diklaim_pada: r.diklaimPada.toISOString(),
    selesai_pada: r.selesaiPada?.toISOString() ?? null,
    durasi_ms: r.durasiMs,
    berhasil: r.berhasil,
    galat: r.galat,
    token_masuk: r.tokenMasuk,
    token_keluar: r.tokenKeluar,
    po: r.po ? { nomor: r.po.nomor } : null,
  }));

  return (
    <main className="wrap">
      <header style={{ marginBottom: 16 }}>
        <p className="eyebrow">Ekstraksi scan</p>
        <h1>Gerbang dan catatan pembacaan</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14, maxWidth: 720 }}>
          Keadaan gerbang berlaku dari baris TERAKHIR, dan setiap perubahan meninggalkan barisnya
          sendiri: riwayatnya tidak bisa disunting siapa pun.
        </p>
      </header>

      <Gerbang berlaku={gerbang ? { menyala: !!gerbang.menyala } : null} />

      <section className="kotak" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Peringatan</h2>
          <span className="hint">wajib dibaca</span>
        </div>
        <p className="muted" style={{ padding: '0 16px 16px', margin: 0, fontSize: 13.5, maxWidth: 720 }}>
          Hasil mentah di halaman ini memuat data pribadi dari pindaian: nama kepala sekolah dan
          bendahara beserta nomor HP-nya. Tampilkan hanya saat perlu.
        </p>
      </section>

      <section className="kotak" style={{ marginBottom: 16 }}>
        <div className="panel-head">
          <h2>Riwayat gerbang</h2>
          <span className="hint">{JUMLAH_RIWAYAT} terakhir</span>
        </div>
        <div className="kisi-rombel">
          <table className="tabel-daftar">
            <thead><tr><th>Waktu</th><th>Keadaan</th><th>Penyedia</th><th>Model</th><th>Penerima risiko</th><th>Diubah oleh</th></tr></thead>
            <tbody>
              {(riwayat ?? []).map((r) => (
                <tr key={r.id}>
                  <td>{waktu(r.diubah_pada)}</td>
                  <td>{r.menyala ? 'menyala' : 'mati'}</td>
                  <td>{r.penyedia ?? '-'}</td>
                  <td>{r.model ?? '-'}</td>
                  <td>{r.risiko_diterima_oleh ?? '-'}</td>
                  <td>{r.diubah_oleh}</td>
                </tr>
              ))}
              {!riwayat?.length && <tr><td colSpan={6}>Belum ada perubahan. Gerbang mati.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="kotak">
        <div className="panel-head">
          <h2>Catatan pembacaan</h2>
          <span className="hint">{JUMLAH_PEMBACAAN} terakhir</span>
        </div>
        <div className="kisi-rombel">
          <table className="tabel-daftar">
            <thead><tr><th>Diklaim</th><th>Oleh</th><th>PO</th><th>Hasil</th><th>Durasi</th><th>Token masuk/keluar</th><th>Isi mentah</th></tr></thead>
            <tbody>
              {(pembacaan ?? []).map((r) => {
                const po = r.po as unknown as { nomor: string | null } | null;
                return (
                  <tr key={r.id}>
                    <td>{waktu(r.diklaim_pada)}</td>
                    <td>{r.diklaim_oleh}</td>
                    <td>{po?.nomor ? <Link href={`/po/${r.po_id}`}>{po.nomor}</Link> : <span className="muted">belum tertaut</span>}</td>
                    <td>
                      {r.selesai_pada === null
                        ? <span className="muted">belum selesai</span>
                        : r.berhasil === true ? 'berhasil' : 'gagal'}
                      {r.galat && <span className="muted"> · {r.galat}</span>}
                    </td>
                    <td>{r.durasi_ms === null ? '-' : `${r.durasi_ms} ms`}</td>
                    <td>{r.token_masuk ?? '-'} / {r.token_keluar ?? '-'}</td>
                    <td>{r.berhasil === true && r.selesai_pada !== null
                      ? <BukaHasil id={r.id} />
                      : <span className="muted">-</span>}</td>
                  </tr>
                );
              })}
              {!pembacaan?.length && <tr><td colSpan={7}>Belum ada pembacaan.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
