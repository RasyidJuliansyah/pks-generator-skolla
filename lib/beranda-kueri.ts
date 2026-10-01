import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';

export type PoBeranda = {
  id: string;
  status: string;
  grand_total: number;
  jumlah_siswa: number;
  dibuat_pada: string;
  diverifikasi_pada: string | null;
  sekolah: { jenjang: string } | null;
};

export type TerminBeranda = {
  po_id: string;
  tanggal: string | null;
  nominal: number;
};

export async function ambilDataBeranda(emailPengguna: string, peran: Peran[]) {
  const lihatSemua = bolehLihatSemua(peran);
  const wherePo = lihatSemua ? {} : { dibuatOleh: emailPengguna.toLowerCase() };

  const [dPoDb, dTerminDb] = await Promise.all([
    prisma.po.findMany({
      where: wherePo,
      select: {
        id: true,
        status: true,
        grandTotal: true,
        jumlahSiswa: true,
        dibuatPada: true,
        diverifikasiPada: true,
        sekolah: {
          select: { jenjang: true },
        },
      },
    }),
    prisma.poTermin.findMany({
      where: lihatSemua ? {} : { po: { dibuatOleh: emailPengguna.toLowerCase() } },
      select: {
        poId: true,
        tanggal: true,
        nominal: true,
      },
    }),
  ]);

  const dPo: PoBeranda[] = dPoDb.map((p) => ({
    id: p.id,
    status: p.status,
    grand_total: Number(p.grandTotal),
    jumlah_siswa: p.jumlahSiswa,
    dibuat_pada: p.dibuatPada.toISOString(),
    diverifikasi_pada: p.diverifikasiPada?.toISOString() ?? null,
    sekolah: p.sekolah ? { jenjang: p.sekolah.jenjang } : null,
  }));

  const dTermin: TerminBeranda[] = dTerminDb.map((t) => ({
    po_id: t.poId,
    tanggal: t.tanggal ? t.tanggal.toISOString().slice(0, 10) : null,
    nominal: Number(t.nominal),
  }));

  return { dPo, dTermin };
}

export async function ambilPoUntukKomentar(ids: string[]) {
  if (!ids.length) return [];
  const poDb = await prisma.po.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nomor: true,
      sekolah: {
        select: { nama: true },
      },
    },
  });

  return poDb.map((p) => ({
    id: p.id,
    nomor: Number(p.nomor),
    sekolah: p.sekolah ? { nama: p.sekolah.nama } : null,
  }));
}
