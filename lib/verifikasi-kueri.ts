import prisma from './prisma';
import { SETELAH_VERIFIKASI } from './status-po';
import type { StatusPo } from '@prisma/client';

export type BarisVerifikasi = {
  id: string;
  nomor: number;
  status: string;
  grand_total: number;
  jumlah_siswa: number;
  diubah_pada: string;
  versi: number;
  dibuat_oleh: string;
  sekolah: { nama: string; jenjang: string } | null;
  verifikasi: { fungsi: string; hasil: string; berlaku: boolean }[];
  verifikasi_otomatis: {
    lolos: boolean;
    versi_po: number;
    versi_iom: string;
    dicatat_pada: string;
    paket: string | null;
    kelompok?: string[] | null;
  }[];
};

export type BarisAuto = {
  id: string;
  nomor: number;
  grand_total: number;
  jumlah_siswa: number;
  diverifikasi_pada: string | null;
  dibaca_ai_pada: string | null;
  sekolah: { nama: string; jenjang: string } | null;
  verifikasi_otomatis: BarisVerifikasi['verifikasi_otomatis'];
};

function petakanBaris(p: any): BarisVerifikasi {
  return {
    id: p.id,
    nomor: Number(p.nomor),
    status: p.status,
    grand_total: Number(p.grandTotal),
    jumlah_siswa: p.jumlahSiswa,
    diubah_pada: p.diubahPada.toISOString(),
    versi: p.versi,
    dibuat_oleh: p.dibuatOleh,
    sekolah: p.sekolah ? { nama: p.sekolah.nama, jenjang: p.sekolah.jenjang } : null,
    verifikasi: (p.verifikasi || []).map((v: any) => ({
      fungsi: v.fungsi,
      hasil: v.hasil,
      berlaku: v.berlaku,
    })),
    verifikasi_otomatis: (p.verifikasiOtomatis || []).map((vo: any) => ({
      lolos: vo.lolos,
      versi_po: vo.versiPo,
      versi_iom: vo.versiIom,
      dicatat_pada: vo.dicatatPada.toISOString(),
      paket: vo.paket,
      kelompok: vo.kelompok,
    })),
  };
}

export async function ambilAntreanVerifikasi(dari = 0, jumlah = 20): Promise<{
  terbuka: BarisVerifikasi[];
  totalDitutup: number;
  ditutup: BarisVerifikasi[];
  auto: BarisAuto[];
}> {
  const SUDAH_DIVERIFIKASI = ['ditolak', ...SETELAH_VERIFIKASI] as StatusPo[];

  const [terbukaDb, totalDitutup, ditutupDb, autoDb] = await Promise.all([
    prisma.po.findMany({
      where: { status: 'verifikasi' },
      include: {
        sekolah: { select: { nama: true, jenjang: true } },
        verifikasi: { select: { fungsi: true, hasil: true, berlaku: true } },
        verifikasiOtomatis: true,
      },
      orderBy: { diubahPada: 'asc' },
    }),
    prisma.po.count({
      where: { status: { in: SUDAH_DIVERIFIKASI } },
    }),
    prisma.po.findMany({
      where: { status: { in: SUDAH_DIVERIFIKASI } },
      include: {
        sekolah: { select: { nama: true, jenjang: true } },
        verifikasi: { select: { fungsi: true, hasil: true, berlaku: true } },
        verifikasiOtomatis: true,
      },
      orderBy: { diubahPada: 'desc' },
      skip: dari,
      take: jumlah,
    }),
    prisma.po.findMany({
      where: { diverifikasiOtomatis: true },
      include: {
        sekolah: { select: { nama: true, jenjang: true } },
        verifikasiOtomatis: true,
      },
      orderBy: { diverifikasiPada: 'desc' },
      take: 20,
    }),
  ]);

  return {
    terbuka: terbukaDb.map(petakanBaris),
    totalDitutup,
    ditutup: ditutupDb.map(petakanBaris),
    auto: autoDb.map((p) => ({
      id: p.id,
      nomor: Number(p.nomor),
      grand_total: Number(p.grandTotal),
      jumlah_siswa: p.jumlahSiswa,
      diverifikasi_pada: p.diverifikasiPada?.toISOString() ?? null,
      dibaca_ai_pada: p.dibacaAiPada?.toISOString() ?? null,
      sekolah: p.sekolah ? { nama: p.sekolah.nama, jenjang: p.sekolah.jenjang } : null,
      verifikasi_otomatis: (p.verifikasiOtomatis || []).map((vo: any) => ({
        lolos: vo.lolos,
        versi_po: vo.versiPo,
        versi_iom: vo.versiIom,
        dicatat_pada: vo.dicatatPada.toISOString(),
        paket: vo.paket,
        kelompok: vo.kelompok,
      })),
    })),
  };
}
