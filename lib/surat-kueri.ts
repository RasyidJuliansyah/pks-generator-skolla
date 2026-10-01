import prisma from './prisma';
import { SETELAH_VERIFIKASI } from './status-po';
import type { StatusPo } from '@prisma/client';

export type BarisSurat = {
  id: string;
  nomor: number;
  grand_total: number;
  jumlah_siswa: number;
  diverifikasi_pada: string | null;
  diubah_pada: string;
  sekolah: { nama: string; jenjang: string } | null;
  surat_verifikasi: { berkas: string | null; final_pada: string | null } | null;
  verifikasi: { hasil: string; berlaku: boolean }[];
};

function petakanSurat(p: any): BarisSurat {
  const sv = Array.isArray(p.suratVerifikasi) ? p.suratVerifikasi[0] : p.suratVerifikasi;
  return {
    id: p.id,
    nomor: Number(p.nomor),
    grand_total: Number(p.grandTotal),
    jumlah_siswa: p.jumlahSiswa,
    diverifikasi_pada: p.diverifikasiPada?.toISOString() ?? null,
    diubah_pada: p.diubahPada.toISOString(),
    sekolah: p.sekolah ? { nama: p.sekolah.nama, jenjang: p.sekolah.jenjang } : null,
    surat_verifikasi: sv ? {
      berkas: sv.berkas,
      final_pada: sv.finalPada?.toISOString() ?? null,
    } : null,
    verifikasi: (p.verifikasi || []).map((v: any) => ({
      hasil: v.hasil,
      berlaku: v.berlaku,
    })),
  };
}

export async function ambilDaftarSurat(dari = 0, jumlah = 20): Promise<{
  antrean: BarisSurat[];
  totalArsip: number;
  arsip: BarisSurat[];
}> {
  const statusSetelah = SETELAH_VERIFIKASI as StatusPo[];

  const [antreanDb, totalArsip, arsipDb] = await Promise.all([
    prisma.po.findMany({
      where: { status: 'terverifikasi' },
      include: {
        sekolah: { select: { nama: true, jenjang: true } },
        suratVerifikasi: true,
        verifikasi: { select: { hasil: true, berlaku: true } },
      },
      orderBy: { diverifikasiPada: 'asc' },
    }),
    prisma.suratVerifikasi.count({
      where: {
        finalPada: { not: null },
        po: { status: { in: statusSetelah } },
      },
    }),
    prisma.po.findMany({
      where: {
        status: { in: statusSetelah },
        suratVerifikasi: {
          some: { finalPada: { not: null } },
        },
      },
      include: {
        sekolah: { select: { nama: true, jenjang: true } },
        suratVerifikasi: true,
        verifikasi: { select: { hasil: true, berlaku: true } },
      },
      orderBy: { diverifikasiPada: 'desc' },
      skip: dari,
      take: jumlah,
    }),
  ]);

  return {
    antrean: antreanDb.map(petakanSurat),
    totalArsip,
    arsip: arsipDb.map(petakanSurat),
  };
}
