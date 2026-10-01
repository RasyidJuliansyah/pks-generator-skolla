import { redirect } from 'next/navigation';
import { penggunaHalaman, LABEL_PERAN, type Peran } from '@/lib/sesi';
import prisma from '@/lib/prisma';
import TabelPengguna from './tabel-pengguna';

export const dynamic = 'force-dynamic';

export default async function KelolaPengguna() {
  const hasil = await penggunaHalaman();
  if (hasil.status !== 'ok') redirect('/beranda');
  if (!hasil.pengguna.peran.includes('admin_utama')) redirect('/beranda');

  const penggunaRows = await prisma.pengguna.findMany({
    select: {
      email: true,
      nama: true,
      peran: true,
      aktif: true,
      dibuatPada: true,
    },
    orderBy: [
      { aktif: 'desc' },
      { nama: 'asc' },
    ],
  });

  const daftar = penggunaRows.map((p) => ({
    email: p.email,
    nama: p.nama ?? '',
    peran: (Array.isArray(p.peran) ? p.peran : []) as Peran[],
    aktif: p.aktif,
    dibuat_pada: p.dibuatPada.toISOString(),
  }));
  const aktif = daftar.filter((p) => p.aktif).length;
  const domain = process.env.NEXT_PUBLIC_DOMAIN_WAJIB || 'skolla.education';

  const riwayatRows = await prisma.penggunaRiwayat.findMany({
    select: {
      email: true,
      aksi: true,
      peranLama: true,
      peranBaru: true,
      namaBaru: true,
      aktifLama: true,
      aktifBaru: true,
      oleh: true,
      pada: true,
    },
    orderBy: { pada: 'desc' },
    take: 50,
  });

  const riwayat = riwayatRows.map((r) => ({
    email: r.email,
    aksi: r.aksi,
    peran_lama: (r.peranLama && Array.isArray(r.peranLama) ? r.peranLama : null) as Peran[] | null,
    peran_baru: (r.peranBaru && Array.isArray(r.peranBaru) ? r.peranBaru : null) as Peran[] | null,
    nama_baru: r.namaBaru,
    aktif_lama: r.aktifLama,
    aktif_baru: r.aktifBaru,
    oleh: r.oleh,
    pada: r.pada.toISOString(),
  }));

  const label = (p: Peran[] | null) =>
    (p ?? []).map((x) => LABEL_PERAN[x] ?? x).join(', ') || '-';

  const ringkas = (r: (typeof riwayat)[number]) => {
    if (r.aksi === 'tambah') return `ditambahkan sebagai ${label(r.peran_baru)}`;
    if (r.aksi === 'hapus') return `dihapus (sebelumnya ${label(r.peran_lama)})`;
    const bagian: string[] = [];
    if (label(r.peran_lama) !== label(r.peran_baru))
      bagian.push(`peran ${label(r.peran_lama)} → ${label(r.peran_baru)}`);
    if (r.aktif_lama !== r.aktif_baru)
      bagian.push(r.aktif_baru ? 'diaktifkan kembali' : 'dinonaktifkan');
    return bagian.join(', ') || 'nama diperbarui';
  };

  return (
    <main className="wrap">
      <header style={{ marginBottom: 4 }}>
        <p className="eyebrow">Skolla Package 2026</p>
        <h1>Kelola Pengguna</h1>
        <p className="muted" style={{ margin: '8px 0 0', fontSize: 14 }}>
          {aktif} akun aktif dari {daftar.length} terdaftar. Tabel ini sekaligus daftar
          izin: tanpa baris di sini, akun @{domain} yang sah pun tidak melihat apa pun.
        </p>
      </header>

      <TabelPengguna
        daftar={daftar}
        akuSendiri={hasil.pengguna.email}
        labelPeran={LABEL_PERAN}
      />

      <section className="panel" style={{ marginTop: 28 }}>
        <div className="panel-head"><h2>Riwayat Perubahan</h2>
          <span className="hint">50 terakhir</span></div>
        <p className="muted" style={{ margin: '2px 0 12px', fontSize: 13.5 }}>
          Super Admin berwenang atas seluruh alur, termasuk memberi keputusan verifikasi.
          Daftar ini yang membuat kewenangan itu bisa dipertanggungjawabkan: setiap
          pemberian dan pencabutan peran tercatat, dan tidak ada yang bisa menghapusnya,
          termasuk Super Admin sendiri.
        </p>
        {riwayat.length ? (
          <ol className="riwayat-daftar">
            {riwayat.map((r, i) => (
              <li key={i}>
                <div className="riwayat-kepala">
                  <strong>{r.email.split('@')[0]}</strong>
                  <span className="muted">{ringkas(r)}</span>
                </div>
                <div className="ttd-waktu">
                  oleh {r.oleh?.split('@')[0] ?? 'sistem'} ·{' '}
                  {new Date(r.pada).toLocaleString('id-ID',
                    { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted" style={{ fontSize: 13.5, margin: 0 }}>
            Belum ada perubahan tercatat sejak jejak ini dipasang.
          </p>
        )}
      </section>
    </main>
  );
}
