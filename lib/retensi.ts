import { revalidatePath } from 'next/cache';
import prisma from '@/lib/prisma';
import { penggunaSaatIni } from '@/lib/sesi';
import { hapusBerkas } from '@/lib/storage';

/**
 * Masa simpan data pribadi — SATU sumber, dipakai dokumen maupun daftar jatuh tempo.
 *
 * Diketik sekali karena angkanya muncul di dua dokumen yang ditandatangani sekolah.
 * Kalau diketik dua kali, keduanya akan menyimpang saat kebijakannya berubah — dan
 * yang tercetak di lembar bermeterai adalah yang salah.
 *
 * Kebijakannya diputuskan Rizki 9 Sep 2026; lihat catatan/retensi-data-pribadi.md.
 * Kalimat pemberitahuannya BELUM ditinjau legal dan BELUM dipasang ke dokumen mana pun
 * — lihat catatan/10-draf-pemberitahuan-data-pribadi.md sebelum memakainya.
 */

/** Gambar tanda tangan PO dan Surat Verifikasi, dihitung sejak PKS ditandatangani basah. */
export const BULAN_SIMPAN_TANDA_TANGAN = 12;

/** Dieja untuk dokumen; angka dan hurufnya tidak boleh berbeda. */
export const SEBUT_SIMPAN_TANDA_TANGAN = `${BULAN_SIMPAN_TANDA_TANGAN} (dua belas) bulan`;

/**
 * Berkas yang TIDAK pernah dihapus. Bukan kelalaian — keduanya dokumen perusahaan,
 * bukan jejak proses, dan pindaian PO adalah satu-satunya dokumen PO yang tidak bisa
 * dibangun ulang dari data.
 */
export const TIDAK_DIHAPUS = ['pks-basah', 'po-unggahan'] as const;

/** Jatuh tempo penghapusan gambar tanda tangan sebuah PO. */
export function jatuhTempoTandaTangan(pksDitandatanganiPada: Date): Date {
  const d = new Date(pksDitandatanganiPada);
  d.setMonth(d.getMonth() + BULAN_SIMPAN_TANDA_TANGAN);
  return d;
}

export type BerkasJatuhTempo = {
  po_id: string;
  nomor: number;
  sekolah: string;
  jenis: string;
  bucket: string;
  jalur: string;
  jatuh_tempo: string;
};

export async function daftarJatuhTempo(): Promise<BerkasJatuhTempo[]> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok' || !p.pengguna.peran.includes('admin_utama')) {
    throw new Error('Hanya Super Admin yang boleh melihat daftar jatuh tempo.');
  }

  const hariIniStr = new Date().toISOString().slice(0, 10);

  const [daftarTtd, daftarSurat] = await Promise.all([
    prisma.tandaTangan.findMany({
      where: {
        asal: { not: 'pindaian' },
        berkasDihapusPada: null,
      },
      include: {
        po: {
          select: {
            id: true,
            nomor: true,
            diubahPada: true,
            sekolahBeku: true,
            pks: {
              select: { ditandatanganiPada: true },
              take: 1,
            },
          },
        },
      },
    }),
    prisma.suratVerifikasi.findMany({
      where: {
        berkas: { not: null },
        berkasDihapusPada: null,
      },
      include: {
        po: {
          select: {
            id: true,
            nomor: true,
            diubahPada: true,
            sekolahBeku: true,
            pks: {
              select: { ditandatanganiPada: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  const hasil: BerkasJatuhTempo[] = [];

  for (const item of daftarTtd) {
    const po = item.po;
    if (!po) continue;
    const pksBasah = po.pks[0]?.ditandatanganiPada;
    const dasar = pksBasah ? new Date(pksBasah) : new Date(po.diubahPada);
    const jt = jatuhTempoTandaTangan(dasar);
    const jtStr = jt.toISOString().slice(0, 10);

    if (jtStr <= hariIniStr) {
      const sekolahNama = (po.sekolahBeku as { nama?: string } | null)?.nama || '—';
      hasil.push({
        po_id: po.id,
        nomor: Number(po.nomor),
        sekolah: sekolahNama,
        jenis: 'Tanda tangan PO',
        bucket: 'tanda-tangan',
        jalur: item.berkas,
        jatuh_tempo: jtStr,
      });
    }
  }

  for (const item of daftarSurat) {
    const po = item.po;
    if (!po || !item.berkas) continue;
    const pksBasah = po.pks[0]?.ditandatanganiPada;
    const dasar = pksBasah ? new Date(pksBasah) : new Date(po.diubahPada);
    const jt = jatuhTempoTandaTangan(dasar);
    const jtStr = jt.toISOString().slice(0, 10);

    if (jtStr <= hariIniStr) {
      const sekolahNama = (po.sekolahBeku as { nama?: string } | null)?.nama || '—';
      hasil.push({
        po_id: po.id,
        nomor: Number(po.nomor),
        sekolah: sekolahNama,
        jenis: 'Tanda tangan Surat Verifikasi',
        bucket: 'tanda-tangan',
        jalur: item.berkas,
        jatuh_tempo: jtStr,
      });
    }
  }

  hasil.sort((a, b) => {
    if (a.jatuh_tempo !== b.jatuh_tempo) {
      return a.jatuh_tempo.localeCompare(b.jatuh_tempo);
    }
    return a.nomor - b.nomor;
  });

  return hasil;
}

export async function hapusBerkasJatuhTempo(
  bucket: string,
  jalur: string,
): Promise<{ ok: boolean; galat?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (!p.pengguna.peran.includes('admin_utama')) {
    return { ok: false, galat: 'Hanya Super Admin yang boleh menghapus berkas jatuh tempo.' };
  }

  try {
    await hapusBerkas(bucket, jalur);
  } catch (error: any) {
    return { ok: false, galat: `Gagal menghapus berkas: ${error.message}` };
  }

  try {
    const now = new Date();
    await prisma.$transaction([
      prisma.tandaTangan.updateMany({
        where: { berkas: jalur, asal: { not: 'pindaian' }, berkasDihapusPada: null },
        data: { berkasDihapusPada: now },
      }),
      prisma.suratVerifikasi.updateMany({
        where: { berkas: jalur, berkasDihapusPada: null },
        data: { berkasDihapusPada: now },
      }),
    ]);
  } catch (error: any) {
    return {
      ok: false,
      galat:
        `Berkas sudah terhapus dari penyimpanan, tetapi penandanya gagal dicatat: ${error.message}. ` +
        'Laporkan ini: daftarnya akan terus menampilkan berkas yang sebenarnya sudah hilang.',
    };
  }

  revalidatePath('/retensi');
  return { ok: true };
}

