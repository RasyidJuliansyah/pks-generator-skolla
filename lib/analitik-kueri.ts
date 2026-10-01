import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';
import type { Fungsi } from './checklist';

export type BarisAnalitik = {
  id: string;
  nomor: number;
  status: string;
  grand_total: number;
  jumlah_siswa: number;
  harga_siswa: number;
  dibuat_oleh: string;
  dibuat_pada: string;
  diverifikasi_pada: string | null;
  sumber_dana: string | null;
  sekolah: { jenjang: string; nama: string } | null;
  po_komponen: { komponen_id: string; kelompok?: number }[];
  po_kelompok: { nomor: number; harga_siswa: number }[];
  tanda_tangan: { waktu: string }[];
  verifikasi: { fungsi: Fungsi; hasil: string; berlaku: boolean }[];
  surat_verifikasi: { final_pada: string | null } | null;
  pks: { final_pada: string | null; ditandatangani_pada: string | null } | null;
};

export async function ambilDataAnalitik(emailPengguna: string, peran: Peran[]): Promise<BarisAnalitik[]> {
  const lihatSemua = bolehLihatSemua(peran);
  const where = lihatSemua ? {} : { dibuatOleh: emailPengguna.toLowerCase() };

  const poDb = await prisma.po.findMany({
    where,
    select: {
      id: true,
      nomor: true,
      status: true,
      grandTotal: true,
      jumlahSiswa: true,
      hargaSiswa: true,
      dibuatOleh: true,
      dibuatPada: true,
      diverifikasiPada: true,
      sumberDana: true,
      sekolah: {
        select: { jenjang: true, nama: true },
      },
      komponen: {
        select: { komponenId: true, kelompok: true },
      },
      kelompok: {
        select: { nomor: true, hargaSiswa: true },
      },
      tandaTangan: {
        select: { waktu: true },
      },
      verifikasi: {
        select: { fungsi: true, hasil: true, berlaku: true },
      },
      suratVerifikasi: {
        select: { finalPada: true },
      },
      pks: {
        select: { finalPada: true, ditandatanganiPada: true },
      },
    },
  });

  return poDb.map((p) => {
    const sv = p.suratVerifikasi?.[0];
    const pk = p.pks?.[0];
    return {
      id: p.id,
      nomor: Number(p.nomor),
      status: p.status,
      grand_total: Number(p.grandTotal),
      jumlah_siswa: p.jumlahSiswa,
      harga_siswa: Number(p.hargaSiswa),
      dibuat_oleh: p.dibuatOleh,
      dibuat_pada: p.dibuatPada.toISOString(),
      diverifikasi_pada: p.diverifikasiPada?.toISOString() ?? null,
      sumber_dana: p.sumberDana,
      sekolah: p.sekolah ? { jenjang: p.sekolah.jenjang, nama: p.sekolah.nama } : null,
      po_komponen: (p.komponen || []).map((k) => ({
        komponen_id: k.komponenId,
        kelompok: k.kelompok,
      })),
      po_kelompok: (p.kelompok || []).map((kl) => ({
        nomor: kl.nomor,
        harga_siswa: Number(kl.hargaSiswa),
      })),
      tanda_tangan: (p.tandaTangan || []).map((t) => ({
        waktu: t.waktu.toISOString(),
      })),
      verifikasi: (p.verifikasi || []).map((v) => ({
        fungsi: v.fungsi as Fungsi,
        hasil: v.hasil,
        berlaku: v.berlaku,
      })),
      surat_verifikasi: sv ? {
        final_pada: sv.finalPada?.toISOString() ?? null,
      } : null,
      pks: pk ? {
        final_pada: pk.finalPada?.toISOString() ?? null,
        ditandatangani_pada: pk.ditandatanganiPada?.toISOString().slice(0, 10) ?? null,
      } : null,
    };
  });
}
