import { redirect } from 'next/navigation';
import Link from 'next/link';
import { penggunaHalaman, bolehLihatAcquisition } from '@/lib/sesi';
import { ambilDataBeranda, ambilPoUntukKomentar } from '@/lib/beranda-kueri';
import { komentarBelumDibaca } from '@/lib/komentar';
import { TAHAP_PO, TAHAP_PKS, KODE_TAHAP_PKS, pernahSampai } from '@/lib/status-po';
import { BatangWaktu, Donat, AlurTahap, type Titik } from '@/lib/grafik';
import { bacaRentang, labelBulan, kunciBulan, deretBulanDepan } from '@/lib/periode';
import SaringWaktu from '../saring-waktu';
import { rp, rpSingkat } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard({
  searchParams,
}: { searchParams: Promise<{ periode?: string; dari?: string; sampai?: string }> }) {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  const { pengguna } = hasil;
  const r = bacaRentang(await searchParams);

  const { dPo, dTermin } = await ambilDataBeranda(pengguna.email, pengguna.peran);
  const semuaPo = dPo;

  // Komentar belum dibaca TIDAK ikut saring periode: pertanyaan yang menunggu jawaban
  // tidak berhenti menunggu karena PO-nya dibuat bulan lalu.
  const dBelum = await komentarBelumDibaca(pengguna.email);
  const belum = [...dBelum].sort((a, b) => +new Date(b.terakhir) - +new Date(a.terakhir));
  const dPoBelum = await ambilPoUntukKomentar(belum.map((x) => x.po_id));
  const petaBelum = new Map(dPoBelum.map((p) =>
    [p.id, { nomor: p.nomor, sekolah: p.sekolah?.nama }]));
  const totalBelum = belum.reduce((a, x) => a + Number(x.jumlah), 0);
  const po = r.saring(semuaPo);

  const nilai = po.reduce((a, x) => a + (x.grand_total || 0), 0);
  const siswa = po.reduce((a, x) => a + (x.jumlah_siswa || 0), 0);
  const jadi = po.filter((x) => KODE_TAHAP_PKS.includes(x.status)).length;
  const nilaiJadi = po.filter((x) => KODE_TAHAP_PKS.includes(x.status))
    .reduce((a, x) => a + (x.grand_total || 0), 0);

  // Tren: nilai PO per bulan pembuatan.
  const bulan = r.bulan(12);
  const trenNilai: Titik[] = bulan.map((b) => {
    const isi = po.filter((x) => kunciBulan(x.dibuat_pada) === b);
    const n = isi.reduce((a, x) => a + (x.grand_total || 0), 0);
    return { label: labelBulan(b), nilai: n, ket: isi.length ? `${isi.length} PO` : undefined };
  });

  // Proyeksi penerimaan: termin milik PO yang sudah lewat verifikasi.
  const poLanjut = new Set(
    semuaPo.filter((x) => KODE_TAHAP_PKS.includes(x.status) || x.status === 'terverifikasi')
      .map((x) => x.id)
  );
  const termin = (dTermin ?? []).filter((t) => t.tanggal && poLanjut.has(t.po_id));
  const bulanTermin = deretBulanDepan(6);
  const proyeksi: Titik[] = bulanTermin.map((b) => ({
    label: labelBulan(b),
    nilai: termin.filter((t) => kunciBulan(t.tanggal!) === b)
      .reduce((a, t) => a + (t.nominal || 0), 0),
  }));

  const hitung = (kode: string) => po.filter((x) => x.status === kode).length;
  // Memuat SELURUH status, bukan cuma tahap sebelum PKS. Sebelumnya PO yang
  // sudah jadi PKS lenyap dari panel ini dan tampil sebagai "belum ada data" —
  // padahal PO-nya jelas ada.
  //
  // Yang TIDAK dilakukan: menghitung PO ber-PKS sebagai "Terverifikasi" juga.
  // Pie menjawab "sekarang ada di mana", jadi juringnya harus saling lepas;
  // menghitung satu PO di dua juring membuat totalnya melewati 100%. Pertanyaan
  // "sudah pernah sampai mana" dijawab corong di bawah, yang memang kumulatif.
  const komposisiPo = [...TAHAP_PO, ...TAHAP_PKS]
    .map((s) => ({ label: s.label, jumlah: hitung(s.kode), warna: s.warna }));
  const komposisiPks = TAHAP_PKS.map((s) => ({ label: s.label, jumlah: hitung(s.kode), warna: s.warna }));

  // Corong: berapa PO yang PERNAH mencapai tiap tahap, bukan yang sedang di sana.
  // Urutannya di lib/status-po.ts, satu tempat untuk kedua halaman.
  const sampai = (kode: string) => pernahSampai(po, kode);
  const corong = [
    { label: 'PO dibuat', jumlah: po.filter((x) => x.status !== 'ditolak').length },
    { label: 'Ditandatangani', jumlah: sampai('ditandatangani') },
    { label: 'Masuk verifikasi', jumlah: sampai('verifikasi') },
    { label: 'Terverifikasi', jumlah: sampai('terverifikasi') },
    { label: 'PKS terbit', jumlah: sampai('pks_terbit') },
    { label: 'PKS bermeterai', jumlah: sampai('pks_ditandatangani') },
  ];
  const ditolak = po.filter((x) => x.status === 'ditolak').length;

  const kpi = [
    { label: 'PO pada periode ini', nilai: String(po.length),
      jejak: ditolak ? `${ditolak} ditolak` : 'belum ada yang ditolak' },
    { label: 'Nilai PO', nilai: po.length ? rp(nilai) : 'Rp0',
      jejak: po.length ? `rata-rata ${rpSingkat(nilai / po.length)} per PO` : 'belum ada nilai' },
    { label: 'Kerjasama jadi', nilai: String(jadi),
      jejak: jadi ? `senilai ${rpSingkat(nilaiJadi)}` : 'PKS belum ada yang terbit' },
    { label: 'Siswa terlayani', nilai: siswa ? new Intl.NumberFormat('id-ID').format(siswa) : '0',
      jejak: 'dari seluruh PO pada periode ini' },
  ];

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Dashboard</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Angka di halaman ini mengikuti cakupan peranmu: Sales melihat PO buatannya sendiri.
          {bolehLihatAcquisition(pengguna.peran) && ' Kamu dapat melihat Acquisition Price.'}
          {' '}Penggalian lebih dalam ada di <Link href="/analitik">Analytics</Link>.
        </p>
      </header>

      {belum.length > 0 && (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head"><h2>PO dengan komentar belum Anda baca</h2>
            <span className="hint">{totalBelum} komentar di {belum.length} PO</span></div>
          <ul className="daftar-belum">
            {belum.map((x) => {
              const p = petaBelum.get(x.po_id);
              return (
                <li key={x.po_id}>
                  <Link href={`/po/${x.po_id}`}>PO-{String(p?.nomor ?? '').padStart(3, '0')}</Link>
                  <span>{p?.sekolah ?? '-'}</span>
                  <span className="hitung-baru">{Number(x.jumlah)} baru</span>
                  <span className="muted">
                    terakhir {new Date(x.terakhir).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <SaringWaktu dasar="/beranda" r={r} />

      <div className="kpi">
        {kpi.map((k) => (
          <div className="kpi-kotak" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className={`kpi-angka ${k.nilai === '0' || k.nilai === 'Rp0' ? 'kpi-kosong' : ''}`}>
              {k.nilai}
            </div>
            <div className="kpi-jejak">{k.jejak}</div>
          </div>
        ))}
      </div>

      <section className="panel" style={{ marginTop: 22 }}>
        <div className="panel-head"><h2>Tren Nilai PO</h2>
          <span className="hint">menurut bulan PO dibuat</span></div>
        <BatangWaktu data={trenNilai} judul="Tren nilai PO per bulan" />
      </section>

      <div className="grid-dua">
        <section className="panel">
          <div className="panel-head"><h2>Komposisi PO</h2>
            <span className="hint">seluruh PO, tahap saat ini</span></div>
          <Donat data={komposisiPo} judul="Komposisi status PO" />
        </section>
        <section className="panel">
          <div className="panel-head"><h2>Komposisi PKS</h2>
            <span className="hint">setelah PKS terbit</span></div>
          <Donat data={komposisiPks} judul="Komposisi status PKS" />
        </section>
      </div>

      <section className="panel">
        <div className="panel-head"><h2>PKS Funnel</h2>
          <span className="hint">berapa yang lolos ke tahap berikutnya</span></div>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
          Persentase di antara langkah adalah konversi dari tahap sebelumnya. Yang bisa
          ditindaklanjuti adalah kebocoran antar dua tahap berdekatan, bukan sisa dari awal.
        </p>
        <AlurTahap tahap={corong} />
      </section>

      <section className="panel">
        <div className="panel-head"><h2>Proyeksi Penerimaan</h2>
          <span className="hint">enam bulan ke depan</span></div>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
          Dari termin PO yang sudah terverifikasi ke atas. Ini jadwal tagihan, bukan
          uang yang sudah masuk.
        </p>
        <BatangWaktu data={proyeksi} judul="Proyeksi penerimaan dari termin" />
      </section>
    </main>
  );
}



