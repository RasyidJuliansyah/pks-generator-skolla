import { rp } from '@/lib/format';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penggunaHalaman, adalahLead, adalahHoO } from '@/lib/sesi';
import { ambilAntreanVerifikasi, type BarisVerifikasi as Baris, type BarisAuto } from '@/lib/verifikasi-kueri';
import { verdictTerakhir } from '@/lib/verdict-iom';
import { URUT_FUNGSI, LABEL_FUNGSI, type Fungsi } from '@/lib/checklist';
import { SETELAH_VERIFIKASI } from '@/lib/status-po';
import { halaman } from '@/lib/paginasi';
import HalamanNav from '../halaman-nav';

export const dynamic = 'force-dynamic';

const PER_HALAMAN = 20;

/** setuju_catatan bukan penolakan: tetap lampu hijau, hanya membawa syarat. */
const WARNA: Record<string, string> = { setuju: 'hijau', setuju_catatan: 'kuning', tolak: 'merah' };
const LENCANA_PO: Record<string, string> = {
  verifikasi: '', terverifikasi: 'hijau', ditolak: 'merah',
};

const KETERANGAN: Record<string, string> = {
  setuju: 'lampu hijau', setuju_catatan: 'hijau dengan catatan', tolak: 'ditolak',
};

const tgl = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function Antrean({
  searchParams,
}: { searchParams: Promise<{ hal?: string }> }) {
  const { hal } = await searchParams;
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');

  const peran = hasil.pengguna.peran;
  const fungsiSaya = URUT_FUNGSI.filter((f) => peran.includes(f)) as Fungsi[];
  const lead = adalahLead(peran);
  const hoo = adalahHoO(peran);
  if (!fungsiSaya.length && !lead && !hoo) redirect('/beranda');

  // Ambil count terlebih dahulu untuk paginasi
  const { totalDitutup } = await ambilAntreanVerifikasi(0, 1);
  const count = totalDitutup;
  const h = halaman(count, PER_HALAMAN, hal);

  const { terbuka, ditutup, auto } = await ambilAntreanVerifikasi(h.dari, PER_HALAMAN);

  const keputusan = (p: Baris) => (p.verifikasi ?? []).filter((v) => v.berlaku);
  const sudahDiputus = (p: Baris) =>
    fungsiSaya.length > 0 && fungsiSaya.every((f) => keputusan(p).some((v) => v.fungsi === f));

  const antrean = terbuka;
  const menunggu = antrean.filter((p) => !sudahDiputus(p));
  const selesai = ditutup;
  const autoBaris = auto;

  const tabel = (baris: Baris[], kosong: string) =>
    !baris.length ? (
      <div className="kosong"><strong>{kosong}</strong></div>
    ) : (
      <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
        <div className="gulir">
          <table className="tabel-daftar">
            <thead>
              <tr><th>Nomor</th><th>Sekolah</th><th>Siswa</th><th>Nilai</th><th>Lampu hijau</th><th>Status</th><th>Diperbarui</th></tr>
            </thead>
            <tbody>
              {baris.map((p) => {
                const s = p.sekolah as unknown as { nama: string; jenjang: string } | null;
                const v = ((p.verifikasi ?? []) as { fungsi: string; hasil: string; berlaku: boolean }[])
                  .filter((x) => x.berlaku);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                    <td>{s?.nama ?? '-'} <span className="muted">{s?.jenjang}</span></td>
                    <td>{p.jumlah_siswa}</td>
                    <td>{rp(p.grand_total)}</td>
                    <td>
                      {/* Tertutup tanpa satu pun keputusan fungsi: hanya mungkin lewat penutupan otomatis. */}
                      {p.status !== 'verifikasi' && !v.length && verdictTerakhir(p.verifikasi_otomatis)?.lolos
                        ? <span className="lencana hijau">lolos otomatis</span>
                        : <>
                      {URUT_FUNGSI.map((f) => {
                        const k = v.find((x) => x.fungsi === f);
                        return (
                          <span key={f} className={`titik-fungsi ${k ? WARNA[k.hasil] ?? 'merah' : ''}`}
                            title={`${LABEL_FUNGSI[f]}: ${k ? KETERANGAN[k.hasil] ?? 'ditolak' : 'menunggu'}`} />
                        );
                      })}
                      <span className="muted" style={{ marginLeft: 8, fontSize: 12 }}>{v.length}/4</span>
                      </>}
                    </td>
                    <td><span className={`lencana ${LENCANA_PO[p.status] ?? ''}`}>
                      {p.status.replace(/_/g, ' ')}</span></td>
                    <td className="muted">{tgl(p.diubah_pada)}</td>
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
        <h1>Antrean Verifikasi</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          {fungsiSaya.length
            ? `Kamu memutuskan untuk ${fungsiSaya.map((f) => LABEL_FUNGSI[f]).join(' dan ')}.`
            : lead
              ? 'Kamu menutup tahap verifikasi sebagai Tech Ops Lead.'
              : 'Kamu menerima kabar PO yang dikonfirmasi sistem menurut aturan IoM.'}
          {' '}Keempat fungsi berjalan paralel, tidak perlu menunggu giliran.
        </p>
      </header>

      {(lead || hoo) && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>
            Terverifikasi otomatis IoM{autoBaris.length ? ` (${autoBaris.length})` : ''}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            PO yang memenuhi seluruh aturan IoM dan ditutup sistem tanpa keputusan keempat
            fungsi. Kamu menerima kabarnya di sini; tidak ada yang perlu dikerjakan. Dua puluh
            terbaru, terbaru di atas.
          </p>
          {!autoBaris.length ? (
            <div className="kosong"><strong>Belum ada PO yang lolos otomatis</strong></div>
          ) : (
            <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
              <div className="gulir">
                <table className="tabel-daftar">
                  <thead><tr><th>Nomor</th><th>Sekolah</th><th>Paket</th><th>Siswa</th><th>Nilai</th><th>Ditutup</th></tr></thead>
                  <tbody>
                    {autoBaris.map((p) => {
                      const v = verdictTerakhir(p.verifikasi_otomatis);
                      return (
                        <tr key={p.id}>
                          <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                          <td>{p.sekolah?.nama ?? '-'} <span className="muted">{p.sekolah?.jenjang}</span>
                            {/* Lencana "dibaca AI" di samping "lolos otomatis" (catatan/17
                                amandemen 1): inilah tempat HoO dan Tech Ops Lead menerima kabar
                                penutupan otomatis, dan di sini pula ia memutuskan PO mana yang
                                perlu diperiksa acak. Tanpa penandanya, pilihannya buta. */}
                            {p.dibaca_ai_pada && <> <span className="lencana kuning">dibaca AI</span></>}
                          </td>
                          <td>{(v?.kelompok?.length ? v.kelompok.join(' + ') : v?.paket) ?? '-'}</td>
                          <td>{p.jumlah_siswa}</td>
                          <td>{rp(p.grand_total)}</td>
                          <td className="muted">{p.diverifikasi_pada ? tgl(p.diverifikasi_pada) : '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>
        Sedang Diverifikasi{menunggu.length ? ` (${menunggu.length})` : ''}
      </h2>
      {tabel(menunggu, 'Tidak ada yang menunggu keputusanmu')}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '28px 0 0' }}>
        Sudah Diverifikasi{count ? ` (${count})` : ''}
      </h2>
      <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
        PO yang tahap verifikasinya sudah ditutup, beserta status akhirnya,
        terverifikasi atau ditolak, dan keputusan tiap fungsi. Terbaru di atas
        {h.jumlah > 1 && ` · halaman ${h.kini} dari ${h.jumlah}`}.
      </p>
      {tabel(selesai, 'Belum ada yang selesai diverifikasi')}
      <HalamanNav h={h} label="Navigasi PO yang sudah diverifikasi"
        taut={(x) => (x ? `/verifikasi?hal=${x}` : '/verifikasi')} />
    </main>
  );
}
