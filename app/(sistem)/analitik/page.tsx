import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  penggunaHalaman, bolehLihatAcquisition, daftarPengguna,
} from '@/lib/sesi';
import { ambilDataAnalitik, type BarisAnalitik as BarisPo } from '@/lib/analitik-kueri';
import { bacaRentang, labelBulan, kunciBulan } from '@/lib/periode';
import { satu } from '@/lib/relasi';
import { KOMPONEN, PRESET } from '@/lib/pricelist';
import { ID_GURU } from '@/lib/aturan-komponen';
import { LABEL_FUNGSI, URUT_FUNGSI, type Fungsi } from '@/lib/checklist';
import { namaPaketPks } from '@/lib/dokumen-dari-po';
import { BatangPeringkat, Donat, AlurTahap, BatangWaktu, type Titik } from '@/lib/grafik';
import { PALET, pernahSampai } from '@/lib/status-po';
import { rp, rpSingkat } from '@/lib/format';
import SaringWaktu from '../saring-waktu';

export const dynamic = 'force-dynamic';

const hari = (a?: string | null, b?: string | null) =>
  a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000 : null;

/** Median lebih jujur daripada rata-rata di sini: satu PO yang tertahan
 *  berbulan-bulan menggeser rata-rata sampai angkanya tidak mewakili siapa pun. */
function median(n: number[]): number | null {
  if (!n.length) return null;
  const u = [...n].sort((a, b) => a - b);
  const t = Math.floor(u.length / 2);
  return u.length % 2 ? u[t] : (u[t - 1] + u[t]) / 2;
}

const bulat = (n: number) => Math.round(n * 10) / 10;

export default async function Analitik({
  searchParams,
}: { searchParams: Promise<{ periode?: string; dari?: string; sampai?: string; sales?: string }> }) {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  const acq = bolehLihatAcquisition(hasil.pengguna.peran);
  const q = await searchParams;
  const r = bacaRentang(q);

  const dPo = await ambilDataAnalitik(hasil.pengguna.email, hasil.pengguna.peran);
  const po = r.saring(dPo);
  const akun = await daftarPengguna();
  const namaSales = (email: string) =>
    akun.find((a) => a.email === email)?.nama || email.split('@')[0];

  // --- Lama tiap tahap ---
  const ttdTerakhir = (x: BarisPo) => {
    const w = (x.tanda_tangan ?? []).map((t) => t.waktu).sort();
    return w.length >= 3 ? w[w.length - 1] : null;
  };
  const suratFinal = (x: BarisPo) =>
    satu<{ final_pada: string | null }>(x.surat_verifikasi)?.final_pada ?? null;
  const pksDari = (x: BarisPo) =>
    satu<{ final_pada: string | null; ditandatangani_pada: string | null }>(x.pks);

  const tahap: { label: string; nilai: number[] }[] = [
    { label: 'Dibuat → ditandatangani', nilai: [] },
    { label: 'Ditandatangani → terverifikasi', nilai: [] },
    { label: 'Terverifikasi → surat final', nilai: [] },
    { label: 'Surat final → PKS final', nilai: [] },
    { label: 'PKS final → bermeterai', nilai: [] },
  ];
  for (const x of po) {
    const t = ttdTerakhir(x), s = suratFinal(x), k = pksDari(x);
    const pasang: [number, number | null][] = [
      [0, hari(x.dibuat_pada, t)],
      [1, hari(t, x.diverifikasi_pada)],
      [2, hari(x.diverifikasi_pada, s)],
      [3, hari(s, k?.final_pada)],
      [4, hari(k?.final_pada, k?.ditandatangani_pada)],
    ];
    for (const [i, d] of pasang) if (d !== null && d >= 0) tahap[i].nilai.push(d);
  }
  const lamaTahap = tahap.map((t) => ({
    label: t.label,
    nilai: bulat(median(t.nilai) ?? 0),
    ket: t.nilai.length ? `${t.nilai.length} PO` : 'belum ada',
  }));
  const terlama = [...lamaTahap].sort((a, b) => b.nilai - a.nilai)[0];

  // --- Penolakan verifikasi per fungsi (termasuk yang sudah digantikan) ---
  const semuaKeputusan = po.flatMap((x) => x.verifikasi ?? []);
  const tolakPerFungsi = URUT_FUNGSI.map((f) => {
    const milik = semuaKeputusan.filter((k) => k.fungsi === f);
    const tolak = milik.filter((k) => k.hasil === 'tolak').length;
    return {
      label: LABEL_FUNGSI[f], nilai: tolak,
      ket: milik.length ? `dari ${milik.length} keputusan` : 'belum memutuskan',
      warna: 'ditolak',
    };
  }).sort((a, b) => b.nilai - a.nilai);
  const catatanKerja = semuaKeputusan.filter((k) => k.hasil === 'setuju_catatan').length;

  // --- Sebaran paket dan jenjang ---
  const paketPo = po.map((x) =>
    namaPaketPks((x.po_komponen ?? []).map((k) => k.komponen_id)));
  const namaPaket = [...new Set(paketPo)].sort();
  const sebaranPaket = namaPaket.map((n, i) => ({
    label: n, jumlah: paketPo.filter((p) => p === n).length,
    warna: PALET[i % PALET.length],
  })).sort((a, b) => b.jumlah - a.jumlah);

  const jenjangPo = po.map((x) =>
    x.sekolah?.jenjang ?? '-');
  const sebaranJenjang = ['SD', 'SMP', 'SMA'].map((j, i) => ({
    label: j, jumlah: jenjangPo.filter((x) => x === j).length,
    warna: PALET[i],
  }));

  // --- Komponen paling sering dipilih ---
  const hitungKomponen = new Map<string, number>();
  for (const x of po) {
    for (const k of x.po_komponen ?? []) {
      hitungKomponen.set(k.komponen_id, (hitungKomponen.get(k.komponen_id) ?? 0) + 1);
    }
  }
  const komponenTeratas = [...hitungKomponen.entries()]
    .map(([id, n]) => ({ label: KOMPONEN.find((k) => k.id === id)?.n ?? id, jumlah: n }))
    .sort((a, b) => b.jumlah - a.jumlah).slice(0, 8)
    .map((k, i) => ({ ...k, warna: PALET[i % PALET.length] }));

  // --- Kinerja sales ---
  const emailSales = [...new Set(po.map((x) => x.dibuat_oleh))];
  const kinerja = emailSales.map((e) => {
    const milik = po.filter((x) => x.dibuat_oleh === e);
    const jadi = milik.filter((x) => !!pksDari(x)?.ditandatangani_pada).length;
    const nilai = milik.reduce((a, x) => a + (x.grand_total || 0), 0);
    return {
      label: namaSales(e), nilai, jumlah: milik.length, jadi,
      ket: `${milik.length} PO · ${jadi} jadi`,
    };
  }).sort((a, b) => b.nilai - a.nilai);

  // --- Kedalaman negosiasi terhadap Price List ---
  const diskon: number[] = [];
  for (const x of po) {
    // PO berkelompok: harga_siswa PO-nya 0, jadi dulu terlewat diam-diam. Diskonnya dihitung
    // PER KELOMPOK terhadap isi kelompok itu sendiri — satu kelompok, satu titik data.
    const kel = x.po_kelompok ?? [];
    if (kel.length >= 2) {
      for (const k of kel) {
        const d = (x.po_komponen ?? []).filter((c) => (c.kelompok ?? 1) === k.nomor && !ID_GURU.includes(c.komponen_id))
          .reduce((a, c) => a + (KOMPONEN.find((p) => p.id === c.komponen_id)?.p?.[0] ?? 0), 0);
        if (d > 0 && k.harga_siswa > 0) diskon.push((1 - k.harga_siswa / d) * 100);
      }
      continue;
    }
    const ids = (x.po_komponen ?? []).map((k) => k.komponen_id);
    const daftar = ids.reduce((a, id) => {
      const k = KOMPONEN.find((c) => c.id === id);
      return a + (k?.p?.[0] ?? 0);
    }, 0);
    if (daftar > 0 && x.harga_siswa > 0) diskon.push((1 - x.harga_siswa / daftar) * 100);
  }
  const diskonMedian = median(diskon);

  // --- Corong per sales ---
  // Penyaring ini SENGAJA hanya mengubah panelnya sendiri, bukan seluruh
  // halaman: mencampur "analitik semua orang" dengan "analitik satu orang"
  // dalam satu layar membuat angka di panel lain salah dibaca.
  const salesTerpilih = emailSales.includes(q.sales ?? '') ? q.sales! : null;
  const poCorong = salesTerpilih ? po.filter((x) => x.dibuat_oleh === salesTerpilih) : po;
  const sampai = (kode: string) => pernahSampai(poCorong, kode);
  const corongSales = [
    { label: 'PO dibuat', jumlah: poCorong.filter((x) => x.status !== 'ditolak').length },
    { label: 'Ditandatangani', jumlah: sampai('ditandatangani') },
    { label: 'Masuk verifikasi', jumlah: sampai('verifikasi') },
    { label: 'Terverifikasi', jumlah: sampai('terverifikasi') },
    { label: 'PKS terbit', jumlah: sampai('pks_terbit') },
    { label: 'PKS bermeterai', jumlah: sampai('pks_ditandatangani') },
  ];
  const tautCorong = (email: string | null) => {
    const p = new URLSearchParams();
    if (r.khusus) { p.set('dari', r.dari!); p.set('sampai', r.sampai!); }
    else if (r.periode !== '12') p.set('periode', r.periode);
    if (email) p.set('sales', email);
    const t = p.toString();
    return t ? `/analitik?${t}` : '/analitik';
  };

  // --- Analitik PKS ---
  const punyaPks = po.filter((x) => !!pksDari(x));
  const bermeterai = po.filter((x) => !!pksDari(x)?.ditandatangani_pada);
  const nilaiPipeline = po.reduce((a, x) => a + (x.grand_total || 0), 0);
  const nilaiJadi = bermeterai.reduce((a, x) => a + (x.grand_total || 0), 0);

  const trenPks: Titik[] = r.bulan(12).map((b) => {
    const isi = bermeterai.filter((x) =>
      kunciBulan(pksDari(x)!.ditandatangani_pada!) === b);
    return {
      label: labelBulan(b),
      nilai: isi.reduce((a, x) => a + (x.grand_total || 0), 0),
      ket: isi.length ? `${isi.length} PKS` : undefined,
    };
  });

  // PKS yang sudah final tapi pindaiannya belum masuk — inilah yang menggantung.
  const kini = Date.now();
  const tertahan = po
    .filter((x) => { const k = pksDari(x); return k?.final_pada && !k.ditandatangani_pada; })
    .map((x) => ({
      label: x.sekolah?.nama ?? `PO-${String(x.nomor).padStart(3, '0')}`,
      nilai: Math.max(0, Math.round(
        (kini - new Date(pksDari(x)!.final_pada!).getTime()) / 86_400_000)),
      ket: rpSingkat(x.grand_total || 0),
      warna: 'pks-terbit',
    }))
    .sort((a, b) => b.nilai - a.nilai);

  const kosong = po.length === 0;

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Analytics</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          Menggali lebih dalam daripada ringkasan di <Link href="/beranda">Dashboard</Link>.
          Angkanya mengikuti cakupan peranmu.
        </p>
      </header>

      <SaringWaktu dasar="/analitik" r={r} simpan={{ sales: salesTerpilih ?? undefined }} />

      {kosong ? (
        <div className="kosong">
          <strong>Belum ada PO pada rentang ini</strong>
          <p>Ubah rentang waktunya, atau tunggu PO pertama tersimpan.</p>
        </div>
      ) : (
        <>
          <section className="panel" style={{ marginTop: 6 }}>
            <div className="panel-head"><h2>Lama Tiap Tahap</h2>
              <span className="hint">median hari</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Median, bukan rata-rata: satu PO yang tertahan berbulan-bulan menggeser
              rata-rata sampai angkanya tidak mewakili siapa pun.
              {terlama && terlama.nilai > 0 &&
                ` Paling lama sekarang: ${terlama.label.toLowerCase()}, ${terlama.nilai} hari.`}
            </p>
            <BatangPeringkat data={lamaTahap} judul="Lama tiap tahap"
              satuan="hari" />
          </section>

          <div className="grid-dua">
            <section className="panel">
              <div className="panel-head"><h2>Sebaran Paket</h2>
                <span className="hint">paket yang dipilih sekolah</span></div>
              <Donat data={sebaranPaket} judul="Sebaran paket" />
            </section>
            <section className="panel">
              <div className="panel-head"><h2>Sebaran Jenjang</h2>
                <span className="hint">SD, SMP, SMA</span></div>
              <Donat data={sebaranJenjang} judul="Sebaran jenjang" />
            </section>
          </div>

          <section className="panel">
            <div className="panel-head"><h2>Penolakan Verifikasi</h2>
              <span className="hint">per fungsi</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Termasuk penolakan yang sudah diperbaiki Sales, itu justru yang menunjukkan
              di mana PO paling sering meleset.
              {catatanKerja > 0 && ` Selain itu ada ${catatanKerja} keputusan "setuju dengan catatan".`}
            </p>
            <BatangPeringkat data={tolakPerFungsi} judul="Penolakan per fungsi" />
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Komponen Terlaris</h2>
              <span className="hint">delapan teratas</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Menghitung berapa PO memilih tiap komponen, jadi satu PO bisa masuk ke
              beberapa juring sekaligus, angkanya bukan pembagian PO.
            </p>
            <Donat data={komponenTeratas} judul="Komponen terlaris" satuan="dipilih" />
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Kinerja Sales</h2>
              <span className="hint">nilai PO dan yang jadi</span></div>
            <BatangPeringkat data={kinerja} judul="Kinerja sales" satuan="rupiah" />
          </section>

          <section className="panel">
            <div className="panel-head"><h2>Corong per Sales</h2>
              <span className="hint">{salesTerpilih ? namaSales(salesTerpilih) : 'semua sales'}</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Penyaring ini hanya mengubah corong di bawahnya, bukan panel lain di
              halaman ini.
            </p>
            {/* Dropdown, bukan barisan chip: dengan belasan sales barisannya
                memakan beberapa baris penuh dan menenggelamkan corongnya sendiri.
                Formulir GET biasa — pilihannya tersimpan di alamat dan tetap
                jalan tanpa JavaScript. */}
            <form className="cari-baris" style={{ margin: '12px 0 4px' }}>
              {r.khusus && (
                <>
                  <input type="hidden" name="dari" value={r.dari} />
                  <input type="hidden" name="sampai" value={r.sampai} />
                </>
              )}
              {!r.khusus && r.periode !== '12'
                && <input type="hidden" name="periode" value={r.periode} />}
              <div className="f" style={{ margin: 0, flex: '1 1 200px', maxWidth: 280 }}>
                <label htmlFor="f-sales">Sales</label>
                <select id="f-sales" name="sales" defaultValue={salesTerpilih ?? ''}>
                  <option value="">Semua sales</option>
                  {emailSales.map((e) => (
                    <option key={e} value={e}>{namaSales(e)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" className="preset" style={{ alignSelf: 'end' }}>Terapkan</button>
              {salesTerpilih && (
                <Link href={tautCorong(null)} className="preset" style={{ alignSelf: 'end' }}>
                  Semua sales
                </Link>
              )}
            </form>
            <AlurTahap tahap={corongSales} />
          </section>

          <h2 style={{ fontSize: 15, fontWeight: 600, margin: '30px 0 0' }}>Perjanjian (PKS)</h2>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13.5 }}>
            Panel di atas menghitung PO: apa yang masuk pipeline. Yang di bawah
            menghitung PKS: apa yang benar-benar jadi.
          </p>

          <div className="kpi">
            <div className="kpi-kotak">
              <div className="kpi-label">PKS dibuat</div>
              <div className={`kpi-angka ${punyaPks.length ? '' : 'kpi-kosong'}`}>{punyaPks.length}</div>
              <div className="kpi-jejak">dari {po.length} PO pada rentang ini</div>
            </div>
            <div className="kpi-kotak">
              <div className="kpi-label">Sudah bermeterai</div>
              <div className={`kpi-angka ${bermeterai.length ? '' : 'kpi-kosong'}`}>{bermeterai.length}</div>
              <div className="kpi-jejak">
                {punyaPks.length
                  ? `${Math.round((bermeterai.length / punyaPks.length) * 100)}% dari PKS yang dibuat`
                  : 'belum ada PKS'}
              </div>
            </div>
            <div className="kpi-kotak">
              <div className="kpi-label">Nilai jadi</div>
              <div className={`kpi-angka ${nilaiJadi ? '' : 'kpi-kosong'}`}>{rp(nilaiJadi)}</div>
              <div className="kpi-jejak">
                {nilaiPipeline
                  ? `${Math.round((nilaiJadi / nilaiPipeline) * 100)}% dari nilai pipeline`
                  : 'belum ada nilai'}
              </div>
            </div>
            <div className="kpi-kotak">
              <div className="kpi-label">Menggantung</div>
              <div className={`kpi-angka ${tertahan.length ? '' : 'kpi-kosong'}`}>{tertahan.length}</div>
              <div className="kpi-jejak">
                {tertahan.length ? `terlama ${tertahan[0].nilai} hari` : 'tidak ada yang menunggu'}
              </div>
            </div>
          </div>

          <section className="panel">
            <div className="panel-head"><h2>Tren PKS Bermeterai</h2>
              <span className="hint">menurut tanggal pada dokumen</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Memakai tanggal yang tertulis di dokumen, bukan tanggal unggah: itu yang
              menentukan kapan kerjasamanya sah.
            </p>
            <BatangWaktu data={trenPks} judul="Tren nilai PKS bermeterai" />
          </section>

          <section className="panel">
            <div className="panel-head"><h2>PKS Menggantung</h2>
              <span className="hint">final tapi pindaiannya belum masuk</span></div>
            <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
              Sudah difinalisasi dan siap ditandatangani basah, tapi hasil pindaiannya
              belum diunggah. Urut dari yang paling lama menunggu.
            </p>
            <BatangPeringkat data={tertahan} judul="PKS menggantung" satuan="hari" />
          </section>

          {acq && (
            <section className="panel">
              <div className="panel-head"><h2>Kedalaman Negosiasi</h2>
                <span className="hint">terhadap Price List</span></div>
              <p className="muted" style={{ margin: '2px 0 0', fontSize: 13 }}>
                Selisih harga kesepakatan per siswa terhadap harga daftar komponen yang
                dipilih. {diskonMedian === null
                  ? 'Belum bisa dihitung pada rentang ini.'
                  : `Median potongan ${bulat(diskonMedian)}% dari ${diskon.length} PO.`}
              </p>
              <p className="muted" style={{ margin: '8px 0 0', fontSize: 12.5 }}>
                Hanya terlihat oleh peran yang berhak melihat Acquisition Price.
                Nilai total pada rentang ini {rp(po.reduce((a, x) => a + (x.grand_total || 0), 0))}.
              </p>
            </section>
          )}
        </>
      )}
    </main>
  );
}
