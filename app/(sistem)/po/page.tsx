import { rp } from '@/lib/format';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { komentarBelumDibaca } from '@/lib/komentar';
import { penggunaHalaman, bolehBuatPo } from '@/lib/sesi';
import { hitungPoPerStatus, ambilDaftarPo } from '@/lib/po-kueri';
import { TAHAP_PO as STATUS, TAHAP_PKS, KODE_TAHAP_PO, KODE_TAHAP_PKS } from '@/lib/status-po';
import { halaman } from '@/lib/paginasi';
import HalamanNav from '../halaman-nav';

const PER_HALAMAN = 20;

export const dynamic = 'force-dynamic';

const tgl = (s: string) =>
  new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function DaftarPo({
  searchParams,
}: { searchParams: Promise<{ status?: string; semua?: string; hal?: string }> }) {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/masuk');
  const { status: saring, semua: mintaSemua, hal } = await searchParams;
  // Daftar ini bawaannya hanya menampilkan PO yang masih berjalan. Yang sudah
  // jadi PKS tetap bisa dipanggil, karena Sales mencarinya di sini — bukan di
  // menu Perjanjian — ketika ingin melihat kembali PO asalnya.
  const ikutPks = mintaSemua === '1' || (!!saring && KODE_TAHAP_PKS.includes(saring));

  const hitungan = await hitungPoPerStatus(hasil.pengguna.email, hasil.pengguna.peran);
  const perStatus = Object.fromEntries(
    hitungan.map((x) => [x.status, Number(x.jumlah)]));
  const hitung = (kode: string) => perStatus[kode] ?? 0;
  const belum = await komentarBelumDibaca(hasil.pengguna.email);
  const belumPer = new Map(belum.map((x) => [x.po_id, Number(x.jumlah)]));

  const cakupan = saring
    ? [saring]
    : (ikutPks ? [...KODE_TAHAP_PO, ...KODE_TAHAP_PKS] : KODE_TAHAP_PO);
  const total = cakupan.reduce((a, k) => a + hitung(k), 0);
  const h = halaman(total, PER_HALAMAN, hal);

  const daftar = await ambilDaftarPo({
    emailPengguna: hasil.pengguna.email,
    peran: hasil.pengguna.peran,
    cakupan,
    dari: h.dari,
    jumlah: PER_HALAMAN,
  });

  const tampil = daftar;
  const nilaiTampil = tampil.reduce((a, p) => a + (p.grand_total || 0), 0);
  const taut = (ubah: { status?: string; semua?: string; hal?: string }) => {
    const p = new URLSearchParams();
    if (ubah.status) p.set('status', ubah.status);
    if (ubah.semua) p.set('semua', ubah.semua);
    if (ubah.hal) p.set('hal', ubah.hal);
    const q = p.toString();
    return q ? `/po?${q}` : '/po';
  };

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Skolla Package 2026</p>
          <h1>Daftar PO</h1>
          <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
            {total
              ? <>
                  {total} PO terlihat oleh peranmu
                  {h.jumlah > 1 && ` · halaman ${h.kini} dari ${h.jumlah}`}
                  {!ikutPks && ' · yang sudah jadi PKS disembunyikan'}
                </>
              : 'Belum ada PO tersimpan.'}
          </p>
        </div>
        {bolehBuatPo(hasil.pengguna.peran) && (
          <Link className="tombol" href="/po/baru" style={{ width: 'auto' }}>
            Buat PO
          </Link>
        )}
      </header>

      <div className="status-baris">
        <Link href={taut({ semua: ikutPks ? '1' : undefined })}
          className="status-chip" aria-current={!saring}>
          <span className="n">{total}</span>
          <span>Semua</span>
        </Link>
        {STATUS.map((s) => {
          const n = hitung(s.kode);
          return (
            <Link
              key={s.kode}
              href={n ? taut({ status: s.kode, semua: ikutPks ? '1' : undefined }) : taut({})}
              className={`status-chip${n ? '' : ' nol'}`}
              aria-current={saring === s.kode}
            >
              <span className={`titik w-${s.warna}`} />
              <span className="n">{n}</span>
              <span>{s.label}</span>
            </Link>
          );
        })}
        {ikutPks && TAHAP_PKS.map((s) => {
          const n = hitung(s.kode);
          return (
            <Link key={s.kode}
              href={n ? taut({ status: s.kode, semua: '1' }) : taut({ semua: '1' })}
              className={`status-chip${n ? '' : ' nol'}`}
              aria-current={saring === s.kode}>
              <span className={`titik w-${s.warna}`} />
              <span className="n">{n}</span>
              <span>{s.label}</span>
            </Link>
          );
        })}
        {/* PO yang sudah jadi PKS tetap tinggal di sini, hanya disembunyikan.
            Statusnya maju terus, jadi corong di Dashboard dan Analytics tetap
            menghitungnya utuh — yang menyempit cuma daftarnya. */}
        <Link href={ikutPks ? taut({}) : taut({ semua: '1' })}
          className={`status-chip${ikutPks ? '' : ' nol'}`} aria-current={ikutPks && !saring}>
          <span>{ikutPks ? 'Sembunyikan yang sudah jadi PKS' : 'Tampilkan yang sudah jadi PKS'}</span>
        </Link>
      </div>

      {!tampil.length ? (
        <div className="kosong">
          <strong>{saring ? 'Tidak ada PO pada status ini' : 'Belum ada PO'}</strong>
          <p>
            {saring
              ? 'Coba pilih status lain, atau lihat semuanya.'
              : 'Mulai dari tombol Buat PO: kalkulatornya akan terbuka, lalu hasilnya tersimpan sebagai draf di sini.'}
          </p>
        </div>
      ) : (
        <div className="kotak" style={{ padding: '14px 0 4px', marginTop: 14 }}>
          <div className="gulir">
            <table className="tabel-daftar">
              <thead>
                <tr>
                  <th>Nomor</th><th>Sekolah</th><th>Status</th>
                  <th>Siswa</th><th>Nilai</th><th>Dibuat oleh</th><th>Diubah</th>
                </tr>
              </thead>
              <tbody>
                {tampil.map((p) => {
                  const s = p.sekolah as unknown as { nama: string; jenjang: string } | null;
                  const st = STATUS.find((x) => x.kode === p.status);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/po/${p.id}`}>PO-{String(p.nomor).padStart(3, '0')}</Link>
                        {!!belumPer.get(p.id) && (
                          <span className="hitung-baru" style={{ marginLeft: 8 }}>
                            {belumPer.get(p.id)} komentar baru
                          </span>
                        )}
                      </td>
                      <td>{s?.nama ?? '-'} <span className="muted">{s?.jenjang}</span></td>
                      <td>
                        <span className="lencana">
                          <span className={`titik titik-baris w-${st?.warna ?? 'muted'}`} />
                          {st?.label ?? p.status}
                        </span>
                      </td>
                      <td>{p.jumlah_siswa}</td>
                      <td>{rp(p.grand_total)}</td>
                      <td className="muted">{p.dibuat_oleh.split('@')[0]}</td>
                      <td className="muted">{tgl(p.diubah_pada)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted" style={{ margin: '10px 0 0', fontSize: 13 }}>
            Nilai {rp(nilaiTampil)} menjumlahkan {tampil.length} PO pada halaman ini.
          </p>
        </div>
      )}

      <HalamanNav h={h} taut={(hal) =>
        taut({ status: saring, semua: ikutPks ? '1' : undefined, hal })} />
    </main>
  );
}
