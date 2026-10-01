import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';
import type { StatusPo } from '@prisma/client';

export type PksRingkas = {
  tahun: number;
  bulan: number;
  final_pada: string | null;
  dibuat_pada: string;
};

export type SuratRingkas = {
  final_pada: string | null;
};

export type BarisPks = {
  id: string;
  nomor: number;
  status: string;
  grand_total: number;
  jumlah_siswa: number;
  diverifikasi_pada: string | null;
  sekolah: { nama: string; jenjang: string } | null;
  surat_verifikasi: SuratRingkas | null;
  pks: PksRingkas | null;
};

export type BarisPksSp = {
  id: string;
  nomor: number;
  grand_total: number;
  jumlah_siswa: number;
  versi: number;
  nilai_sponsorship: number | null;
  sekolah: { nama: string; jenjang: string } | null;
  po_catatan: { jenis: string; isi: string | null }[];
  pks_dokumen_sponsorship: {
    versi_po: number;
    form_ditandatangani: boolean;
    rekening_atas_nama_lembaga: boolean;
    meterai_bila_di_atas_5juta: boolean;
    oleh: string;
    pada: string;
  } | null;
};

/** Mengambil PO berstatus terverifikasi yang belum memiliki baris PKS */
export async function ambilAntreanPks({
  emailPengguna,
  peran,
}: {
  emailPengguna: string;
  peran: Peran[];
}): Promise<BarisPks[]> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = {
    status: 'terverifikasi' as StatusPo,
    pks: { none: {} },
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
      diverifikasiPada: true,
      sekolah: { select: { nama: true, jenjang: true } },
      suratVerifikasi: { select: { finalPada: true }, take: 1 },
      pks: { select: { tahun: true, bulan: true, finalPada: true, dibuatPada: true }, take: 1 },
    },
    orderBy: { diverifikasiPada: 'desc' },
  });

  return rows.map((r) => ({
    id: r.id,
    nomor: Number(r.nomor),
    status: r.status,
    grand_total: Number(r.grandTotal),
    jumlah_siswa: r.jumlahSiswa,
    diverifikasi_pada: r.diverifikasiPada ? r.diverifikasiPada.toISOString() : null,
    sekolah: r.sekolah,
    surat_verifikasi: r.suratVerifikasi[0]
      ? { final_pada: r.suratVerifikasi[0].finalPada ? r.suratVerifikasi[0].finalPada.toISOString() : null }
      : null,
    pks: r.pks[0]
      ? {
          tahun: r.pks[0].tahun,
          bulan: r.pks[0].bulan,
          final_pada: r.pks[0].finalPada ? r.pks[0].finalPada.toISOString() : null,
          dibuat_pada: r.pks[0].dibuatPada.toISOString(),
        }
      : null,
  }));
}

/** Menghitung jumlah arsip PO yang sudah memiliki PKS */
export async function hitungArsipPks({
  emailPengguna,
  peran,
  statusArsip,
}: {
  emailPengguna: string;
  peran: Peran[];
  statusArsip: string[];
}): Promise<number> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = {
    status: { in: statusArsip as StatusPo[] },
    pks: { some: {} },
    ...(lihatSemua ? {} : { dibuatOleh: emailPengguna.toLowerCase() }),
  };
  return prisma.po.count({ where });
}

/** Mengambil arsip PO yang sudah memiliki PKS, terpaginasi */
export async function ambilArsipPks({
  emailPengguna,
  peran,
  statusArsip,
  dari,
  jumlah,
}: {
  emailPengguna: string;
  peran: Peran[];
  statusArsip: string[];
  dari: number;
  jumlah: number;
}): Promise<BarisPks[]> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = {
    status: { in: statusArsip as StatusPo[] },
    pks: { some: {} },
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
      diverifikasiPada: true,
      sekolah: { select: { nama: true, jenjang: true } },
      suratVerifikasi: { select: { finalPada: true }, take: 1 },
      pks: { select: { tahun: true, bulan: true, finalPada: true, dibuatPada: true }, take: 1 },
    },
    orderBy: { diverifikasiPada: 'desc' },
    skip: dari,
    take: jumlah,
  });

  return rows.map((r) => ({
    id: r.id,
    nomor: Number(r.nomor),
    status: r.status,
    grand_total: Number(r.grandTotal),
    jumlah_siswa: r.jumlahSiswa,
    diverifikasi_pada: r.diverifikasiPada ? r.diverifikasiPada.toISOString() : null,
    sekolah: r.sekolah,
    surat_verifikasi: r.suratVerifikasi[0]
      ? { final_pada: r.suratVerifikasi[0].finalPada ? r.suratVerifikasi[0].finalPada.toISOString() : null }
      : null,
    pks: r.pks[0]
      ? {
          tahun: r.pks[0].tahun,
          bulan: r.pks[0].bulan,
          final_pada: r.pks[0].finalPada ? r.pks[0].finalPada.toISOString() : null,
          dibuat_pada: r.pks[0].dibuatPada.toISOString(),
        }
      : null,
  }));
}

/** Mengambil PO bersponsorship yang menunggu konfirmasi dokumen oleh Finance */
export async function ambilSponsorshipTungguKonfirmasi(): Promise<BarisPksSp[]> {
  const rows = await prisma.po.findMany({
    where: { status: 'pks_terbit' },
    select: {
      id: true,
      nomor: true,
      grandTotal: true,
      jumlahSiswa: true,
      versi: true,
      nilaiSponsorship: true,
      sekolah: { select: { nama: true, jenjang: true } },
      catatan: { select: { jenis: true, isi: true } },
      dokumenSponsorship: true,
    },
    orderBy: { nomor: 'asc' },
  });

  return rows.map((r) => ({
    id: r.id,
    nomor: Number(r.nomor),
    grand_total: Number(r.grandTotal),
    jumlah_siswa: r.jumlahSiswa,
    versi: r.versi,
    nilai_sponsorship: Number(r.nilaiSponsorship),
    sekolah: r.sekolah,
    po_catatan: r.catatan.map((c) => ({ jenis: c.jenis, isi: c.isi })),
    pks_dokumen_sponsorship: r.dokumenSponsorship
      ? {
          versi_po: r.dokumenSponsorship.versiPo,
          form_ditandatangani: r.dokumenSponsorship.formDitandatangani,
          rekening_atas_nama_lembaga: r.dokumenSponsorship.rekeningAtasNamaLembaga,
          meterai_bila_di_atas_5juta: r.dokumenSponsorship.meteraiBilaDiAtas5juta,
          oleh: r.dokumenSponsorship.oleh,
          pada: r.dokumenSponsorship.pada.toISOString(),
        }
      : null,
  }));
}
