import { rp } from '@/lib/format';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penggunaHalaman } from '@/lib/sesi';
import { hitungPoPerStatus } from '@/lib/po-kueri';
import {
  ambilAntreanPks,
  hitungArsipPks,
  ambilArsipPks,
  ambilSponsorshipTungguKonfirmasi,
  type BarisPks,
} from '@/lib/pks-kueri';
import { halaman } from '@/lib/paginasi';
import HalamanNav from '../halaman-nav';
import { SETELAH_VERIFIKASI, RINGKAS_PKS } from '@/lib/status-po';
import { adaSponsorship, konfirmasiBeres } from '@/lib/sponsorship';

export const dynamic = 'force-dynamic';

const PER_HALAMAN = 20;

const tgl = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function DaftarPks({
  searchParams,
}: { searchParams: Promise<{ status?: string; hal?: string }> }) {
  const hasil = await penggunaHalaman();
  const { status: saring, hal } = await searchParams;
  if (hasil.status !== 'ok') redirect('/masuk');

  const hitungan = await hitungPoPerStatus(hasil.pengguna.email, hasil.pengguna.peran);
  const perStatus = Object.fromEntries(
    hitungan.map((x) => [x.status, Number(x.jumlah)]));
  const hitung = (kode: string) => perStatus[kode] ?? 0;

  const pksDari = (p: BarisPks) => p.pks;
  const suratFinal = (p: BarisPks) => !!p.surat_verifikasi?.final_pada;

  const adaAntrean = !saring || saring === 'terverifikasi';
  const antrean = adaAntrean
    ? await ambilAntreanPks({ emailPengguna: hasil.pengguna.email, peran: hasil.pengguna.peran })
    : [];

  // PKS baru boleh disusun setelah Surat Verifikasi Kesiapan difinalisasi.
  const siap = antrean.filter(suratFinal);
  const menungguSurat = antrean.filter((p) => !suratFinal(p));

  const statusArsip = saring && saring !== 'terverifikasi'
    ? [saring] : SETELAH_VERIFIKASI;

  // Hitung jumlah dan ambil data arsip yang sudah memiliki PKS
  const totalArsip = await hitungArsipPks({
    emailPengguna: hasil.pengguna.email,
    peran: hasil.pengguna.peran,
    statusArsip,
  });
  const h = halaman(totalArsip, PER_HALAMAN, hal);

  const berjalan = await ambilArsipPks({
    emailPengguna: hasil.pengguna.email,
    peran: hasil.pengguna.peran,
    statusArsip,
    dari: h.dari,
    jumlah: PER_HALAMAN,
  });

  // Chip "Semua" hanya menjumlahkan status yang memang milik halaman ini
  const totalHalamanIni = SETELAH_VERIFIKASI.reduce((a, k) => a + hitung(k), 0);

  const adalahFinance = hasil.pengguna.peran.includes('finance');

  const semuaTungguSp = adalahFinance ? await ambilSponsorshipTungguKonfirmasi() : [];
  const tungguKonfirmasi = semuaTungguSp.filter((p) =>
    adaSponsorship(p) && !konfirmasiBeres(p.pks_dokumen_sponsorship, p.versi)
  );

  const tabel = (
    baris: BarisPks[],
    kosong: string,
    catatan: string,
    aksi: (p: BarisPks) => React.ReactNode,
    kolomPks = false,
  ) =>
    !baris.length ? (
      <div className="kosong"><strong>{kosong}</strong><p>{catatan}</p></div>
    ) : (
      <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
        <div className="gulir">
          <table className="tabel-daftar">
            <thead>
              <tr>
                <th>PO</th><th>Sekolah</th><th>Siswa</th><th>Nilai</th>
                {kolomPks && <th>Status</th>}
                <th>Terverifikasi</th><th></th>
              </tr>
            </thead>
            <tbody>
              {baris.map((p) => {
                const s = p.sekolah as unknown as { nama: string; jenjang: string } | null;
                const k = pksDari(p);
                return (
                  <tr key={p.id}>
                    <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                    <td>{s?.nama ?? '-'} <span className="muted">{s?.jenjang}</span></td>
                    <td>{p.jumlah_siswa}</td>
                    <td>{rp(p.grand_total)}</td>
                    {kolomPks && (
                      <td>
                        <span className={`lencana ${k?.final_pada ? 'hijau' : ''}`}>
                          {k?.final_pada ? 'Final' : 'Draf'}
                        </span>
                      </td>
                    )}
                    <td className="muted">{p.diverifikasi_pada ? tgl(p.diverifikasi_pada) : '-'}</td>
                    <td>{aksi(p)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );

  const tautan = (id: string, teks: string, utama = false) => (
    <Link href={`/pks/${id}`} className={utama ? 'tombol' : 'preset'}
      style={utama ? { width: 'auto', margin: 0, padding: '6px 12px' } : { padding: '6px 12px' }}>
      {teks}
    </Link>
  );

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Perjanjian Kerja Sama</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          PKS disusun dari PO yang sudah terverifikasi dan Surat Verifikasi Kesiapannya
          sudah final. Setelah difinalisasi, PKS dicetak dua rangkap untuk ditandatangani
          basah di atas meterai.
        </p>
      </header>

      <div className="status-baris">
        <Link href="/pks" className="status-chip" aria-current={!saring}>
          <span className="n">{totalHalamanIni}</span>
          <span>Semua</span>
        </Link>
        {RINGKAS_PKS.map((st) => {
          const n = hitung(st.kode);
          return (
            <Link
              key={st.kode}
              href={n ? `/pks?status=${st.kode}` : '/pks'}
              className={`status-chip${n ? '' : ' nol'}`}
              aria-current={saring === st.kode}
            >
              <span className={`titik w-${st.warna}`} />
              <span className="n">{n}</span>
              <span>{st.label}</span>
            </Link>
          );
        })}
      </div>

      {adalahFinance && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>
            Menunggu konfirmasi dokumen{tungguKonfirmasi.length ? ` (${tungguKonfirmasi.length})` : ''}
          </h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            PO bersponsorship yang PKS-nya sudah difinalisasi. Dokumen sponsorship-nya harus
            dikonfirmasi Finance sebelum Sales bisa mengunggah PKS bermeterai — tanpa itu
            unggahannya ditolak basis data.
          </p>
          {tungguKonfirmasi.length ? (
            <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
              <div className="gulir">
                <table className="tabel-daftar">
                  <thead>
                    <tr>
                      <th>PO</th><th>Sekolah</th><th>Siswa</th><th>Nilai</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tungguKonfirmasi.map((p) => (
                      <tr key={p.id}>
                        <td><Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link></td>
                        <td>{p.sekolah?.nama ?? '-'} <span className="muted">{p.sekolah?.jenjang}</span></td>
                        <td>{p.jumlah_siswa}</td>
                        <td>{rp(p.grand_total)}</td>
                        <td>{tautan(p.id, 'Konfirmasi dokumen')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="kosong">
              <strong>Tidak ada yang menunggu</strong>
              <p>
                PO bersponsorship muncul di sini begitu PKS-nya difinalisasi dan dokumen
                sponsorship-nya belum dikonfirmasi untuk versi PO yang berlaku.
              </p>
            </div>
          )}
        </>
      )}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '24px 0 0' }}>Siap disusun</h2>
      {tabel(siap, 'Tidak ada yang siap disusun',
        'PO yang suratnya sudah difinalisasi Tech Ops Lead akan muncul di sini.',
        (p) => tautan(p.id, 'Susun PKS', true))}

      <h2 style={{ fontSize: 15, fontWeight: 600, margin: '28px 0 0' }}>
        Sudah dibuat{totalArsip ? ` (${totalArsip})` : ''}
      </h2>
      {h.jumlah > 1 && (
        <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
          Terbaru di atas · halaman {h.kini} dari {h.jumlah}
        </p>
      )}
      {tabel(berjalan, 'Belum ada PKS',
        'Draf dan PKS final tercatat di sini. Angka nomor perjanjian ditulis tangan saat penandatanganan.',
        (p) => tautan(p.id, pksDari(p)?.final_pada ? 'Lihat & cetak' : 'Lanjutkan draf'), true)}
      <HalamanNav h={h} label="Navigasi PKS yang sudah dibuat"
        taut={(x) => {
          const q = new URLSearchParams();
          if (saring) q.set('status', saring);
          if (x) q.set('hal', x);
          const t = q.toString();
          return t ? `/pks?${t}` : '/pks';
        }} />

      {menungguSurat.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '28px 0 0' }}>Menunggu surat difinalisasi</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            PO sudah terverifikasi, tapi PKS belum boleh disusun sampai Tech Ops Lead
            memfinalisasi Surat Verifikasi Kesiapan. Surat untuk PO yang lolos verifikasi
            otomatis masih menunggu persetujuan legal atas kalimatnya.
          </p>
          {tabel(menungguSurat, '', '', (p) => (
            <Link href={`/po/${p.id}/surat`} className="preset" style={{ padding: '6px 12px' }}>
              Lihat surat
            </Link>
          ))}
        </>
      )}
    </main>
  );
}
