import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';
import type { StatusPo } from '@prisma/client';

export type StatusJumlah = { status: string; jumlah: number };

/**
 * Menghitung jumlah PO per status sesuai hak akses pengguna.
 * Pengguna dengan hak `bolehLihatSemua` menghitung semua PO.
 * Pengguna lainnya (Sales polos) hanya menghitung PO yang dibuatnya sendiri.
 */
export async function hitungPoPerStatus(
  emailPengguna: string,
  peran: Peran[],
): Promise<StatusJumlah[]> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = lihatSemua ? {} : { dibuatOleh: emailPengguna.toLowerCase() };

  const kelompok = await prisma.po.groupBy({
    by: ['status'],
    where,
    _count: {
      status: true,
    },
  });

  return kelompok.map((k) => ({
    status: k.status,
    jumlah: k._count.status,
  }));
}

export type BarisDaftarPo = {
  id: string;
  nomor: number;
  status: string;
  grand_total: number;
  jumlah_siswa: number;
  dibuat_oleh: string;
  diubah_pada: string;
  sekolah: { nama: string; jenjang: string } | null;
};

/**
 * Mengambil daftar PO dengan paginasi dan filter status untuk tampilan daftar PO.
 */
export async function ambilDaftarPo({
  emailPengguna,
  peran,
  cakupan,
  dari,
  jumlah,
}: {
  emailPengguna: string;
  peran: Peran[];
  cakupan: string[];
  dari: number;
  jumlah: number;
}): Promise<BarisDaftarPo[]> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = {
    status: { in: cakupan as StatusPo[] },
    ...(lihatSemua ? {} : { dibuatOleh: emailPengguna.toLowerCase() }),
  };

  const rows = await prisma.po.findMany({
    where,
    select: {
      id: true,
      nomor: true,
      status: true,
      grandTotal: true,
      jumlahSiswa: true,
      dibuatOleh: true,
      diubahPada: true,
      sekolah: {
        select: {
          nama: true,
          jenjang: true,
        },
      },
    },
    orderBy: {
      diubahPada: 'desc',
    },
    skip: dari,
    take: jumlah,
  });

  return rows.map((r) => ({
    id: r.id,
    nomor: Number(r.nomor),
    status: r.status,
    grand_total: Number(r.grandTotal),
    jumlah_siswa: r.jumlahSiswa,
    dibuat_oleh: r.dibuatOleh,
    diubah_pada: r.diubahPada.toISOString(),
    sekolah: r.sekolah,
  }));
}
export { ambilDetailPo } from './po-detail';

