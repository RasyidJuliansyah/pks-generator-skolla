import Link from 'next/link';
import { redirect } from 'next/navigation';
import { penggunaHalaman, bolehLihatSemua } from '@/lib/sesi';
import { ambilPemegangSekolah, ambilDaftarSekolah, type BarisSekolah } from '@/lib/sekolah-kueri';
import { rp } from '@/lib/format';
import { bacaRentang } from '@/lib/periode';
import { TAHAP_PO, TAHAP_PKS } from '@/lib/status-po';
import { halaman } from '@/lib/paginasi';
import HalamanNav from '../halaman-nav';
import SaringWaktu from '../saring-waktu';

export const dynamic = 'force-dynamic';

const LABEL = Object.fromEntries(
  [...TAHAP_PO, ...TAHAP_PKS].map((s) => [s.kode, s]));

type Kueri = {
  q?: string; sales?: string; po?: string; pks?: string; hal?: string;
  periode?: string; dari?: string; sampai?: string;
};

type BarisPo = BarisSekolah['po'][number];

const PER_HALAMAN = 20;

export default async function DaftarSekolah({
  searchParams,
}: { searchParams: Promise<Kueri> }) {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  const sp = await searchParams;
  const r = bacaRentang({ ...sp, periode: sp.periode ?? 'semua' });

  const pemegang = await ambilPemegangSekolah();

  const statusPo = TAHAP_PO.some((s) => s.kode === sp.po) ? sp.po! : undefined;
  const statusPks = TAHAP_PKS.some((s) => s.kode === sp.pks) ? sp.pks! : undefined;
  const status = [statusPo, statusPks].filter(Boolean) as string[];
  const sales = pemegang.includes(sp.sales ?? '') ? sp.sales! : undefined;

  const { count: totalHitung } = await ambilDaftarSekolah({
    emailPengguna: hasil.pengguna.email,
    peran: hasil.pengguna.peran,
    q: sp.q,
    sales,
    status,
    sejak: r.sejak ?? undefined,
    sampaiIso: r.sampaiIso ?? undefined,
    dari: 0,
    jumlah: 1,
  });
  const count = totalHitung;
  const h = halaman(count, PER_HALAMAN, sp.hal);

  const { daftar } = await ambilDaftarSekolah({
    emailPengguna: hasil.pengguna.email,
    peran: hasil.pengguna.peran,
    q: sp.q,
    sales,
    status,
    sejak: r.sejak ?? undefined,
    sampaiIso: r.sampaiIso ?? undefined,
    dari: h.dari,
    jumlah: PER_HALAMAN,
  });

  const nilai = (po: BarisPo[] | null) =>
    (po ?? []).reduce((a, p) => a + (p.grand_total || 0), 0);
  const totalPo = daftar.reduce((a, s) => a + (s.po?.length ?? 0), 0);

  const lain: Record<string, string | undefined> =
    { q: sp.q, sales, po: statusPo, pks: statusPks };
  const taut = (ubah: Partial<Kueri>) => {
    const p = new URLSearchParams();
    // `hal` sengaja tidak ikut `lain`: mengganti penyaring harus mengembalikan
    // ke halaman satu, kalau tidak orang mendarat di halaman yang tidak ada lagi.
    for (const [k, v] of Object.entries({ ...lain, ...ubah })) if (v) p.set(k, String(v));
    if (r.khusus) { p.set('dari', r.dari!); p.set('sampai', r.sampai!); }
    else if (r.periode !== 'semua') p.set('periode', r.periode);
    const s = p.toString();
    return s ? `/sekolah?${s}` : '/sekolah';
  };
  const adaSaring = !!(sales || statusPo || statusPks || sp.q
    || r.khusus || r.periode !== 'semua');

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Skolla Package 2026</p>
          <h1>Sekolah</h1>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
            {count
              ? <>
                  {count} sekolah{adaSaring ? ' cocok' : ''}
                  {h.jumlah > 1 && ` · halaman ${h.kini} dari ${h.jumlah}`}
                </>
              : (adaSaring
                  ? 'Tidak ada sekolah yang cocok dengan penyaring ini.'
                  : 'Belum ada sekolah yang terlihat oleh peranmu.')}
          </p>
          {/* Angka PO dan nilai HANYA menghitung halaman yang sedang dibuka.
              Disebut apa adanya, karena "9 PO" di atas daftar 20 sekolah dari
              300 akan dikira jumlah keseluruhan. */}
          {daftar.length > 0 && (
            <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
              {totalPo} PO{adaSaring ? ' cocok' : ''} dan nilai{' '}
              {rp(daftar.reduce((a, s) => a + nilai(s.po), 0))} pada halaman ini.
            </p>
          )}
        </div>
      </header>

      <SaringWaktu dasar="/sekolah" r={r} bawaan="semua"
        simpan={{ q: sp.q, sales, po: statusPo, pks: statusPks }} />
      <p className="muted" style={{ margin: '-6px 0 14px', fontSize: 12.5 }}>
        Rentang waktu menyaring berdasarkan tanggal PO dibuat.
      </p>

      <form className="cari-baris" style={{ marginBottom: 18 }}>
        {r.khusus && (
          <>
            <input type="hidden" name="dari" value={r.dari} />
            <input type="hidden" name="sampai" value={r.sampai} />
          </>
        )}
        {!r.khusus && r.periode !== 'semua'
          && <input type="hidden" name="periode" value={r.periode} />}

        <div className="f" style={{ margin: 0, flex: '2 1 220px', maxWidth: 320 }}>
          <label htmlFor="q">Cari sekolah</label>
          <input id="q" name="q" type="search" defaultValue={sp.q ?? ''}
            placeholder="Nama sekolah…" />
        </div>

        {/* Penyaring Sales tampil untuk siapa pun yang memang bisa melihat
            sekolah orang lain. Disembunyikan hanya dari Sales polos, yang bagi
            dirinya seluruh sekolah memang miliknya sendiri. */}
        {bolehLihatSemua(hasil.pengguna.peran) && (
          <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
            <label htmlFor="f-sales">Sales</label>
            <select id="f-sales" name="sales" defaultValue={sales ?? ''}>
              <option value="">Semua sales</option>
              {pemegang.map((e) => (
                <option key={e} value={e}>{e.split('@')[0]}</option>
              ))}
            </select>
          </div>
        )}

        <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
          <label htmlFor="f-po">Status PO</label>
          <select id="f-po" name="po" defaultValue={statusPo ?? ''}>
            <option value="">Semua status PO</option>
            {TAHAP_PO.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
          </select>
        </div>

        <div className="f" style={{ margin: 0, flex: '1 1 150px', maxWidth: 220 }}>
          <label htmlFor="f-pks">Status PKS</label>
          <select id="f-pks" name="pks" defaultValue={statusPks ?? ''}>
            <option value="">Semua status PKS</option>
            {TAHAP_PKS.map((x) => <option key={x.kode} value={x.kode}>{x.label}</option>)}
          </select>
        </div>

        <button type="submit" className="preset" style={{ alignSelf: 'end' }}>Terapkan</button>
        {adaSaring && (
          <Link href="/sekolah" className="preset" style={{ alignSelf: 'end' }}>
            Bersihkan
          </Link>
        )}
      </form>

      {!daftar.length ? (
        <div className="kosong">
          <strong>{adaSaring ? 'Tidak ada sekolah yang cocok' : 'Belum ada sekolah'}</strong>
          <p>
            {adaSaring
              ? 'Longgarkan penyaringnya. Sekolah yang dipegang sales lain memang tidak terlihat.'
              : 'Sekolah tercatat sendiri begitu PO pertamanya dibuat.'}
          </p>
        </div>
      ) : (
        <div className="sekolah-kisi">
          {daftar.map((s) => {
            const po = (s.po ?? []).slice().sort((a, b) => b.nomor - a.nomor);
            return (
              <Link key={s.id} href={`/sekolah/${s.id}`} className="sekolah-kartu">
                <div className="sekolah-kartu-kepala">
                  <strong>{s.nama}</strong>
                  <span className="muted">{s.jenjang}</span>
                </div>
                <div className="muted" style={{ fontSize: 13 }}>
                  {s.npsn ? `NPSN ${s.npsn}` : 'NPSN belum diisi'}
                  {s.kepala_sekolah ? ` · ${s.kepala_sekolah}` : ''}
                </div>
                <div className="sekolah-sales">
                  {s.dipegang_oleh
                    ? <>Sales <strong>{s.dipegang_oleh.split('@')[0]}</strong></>
                    : <span className="muted">Belum ada pemegang</span>}
                </div>
                <div className="status-baris" style={{ margin: '10px 0 0' }}>
                  {po.length ? po.slice(0, 4).map((p) => (
                    <span key={p.id} className="status-chip">
                      <span className={`titik w-${LABEL[p.status]?.warna ?? 'muted'}`} />
                      <span>PO-{String(p.nomor).padStart(3, '0')}</span>
                    </span>
                  )) : <span className="muted" style={{ fontSize: 13 }}>Belum ada PO</span>}
                  {po.length > 4 && (
                    <span className="status-chip nol"><span>+{po.length - 4}</span></span>
                  )}
                </div>
                {po.length > 0 && (
                  <div className="ttd-waktu" style={{ marginTop: 8 }}>
                    {po.length} PO{adaSaring ? ' cocok' : ''} · nilai {rp(nilai(s.po))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      <HalamanNav h={h} taut={(hal) => taut({ hal })} />
    </main>
  );
}
