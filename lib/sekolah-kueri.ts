import prisma from './prisma';
import { bolehLihatSemua, type Peran } from './sesi';
import type { StatusPo } from '@prisma/client';

export type BarisSekolah = {
  id: string;
  nama: string;
  npsn: string | null;
  jenjang: string;
  kepala_sekolah: string | null;
  dipegang_oleh: string | null;
  po: {
    id: string;
    nomor: number;
    status: string;
    grand_total: number;
    dibuat_pada: string;
  }[];
};

export async function ambilPemegangSekolah(): Promise<string[]> {
  const baris = await prisma.sekolah.findMany({
    where: { dipegangOleh: { not: null } },
    select: { dipegangOleh: true },
    distinct: ['dipegangOleh'],
  });
  return baris.map((b) => b.dipegangOleh!).sort();
}

export async function ambilDaftarSekolah({
  emailPengguna,
  peran,
  q,
  sales,
  status,
  sejak,
  sampaiIso,
  dari = 0,
  jumlah = 20,
}: {
  emailPengguna: string;
  peran: Peran[];
  q?: string;
  sales?: string;
  status?: string[];
  sejak?: string;
  sampaiIso?: string;
  dari?: number;
  jumlah?: number;
}): Promise<{ count: number; daftar: BarisSekolah[] }> {
  const lihatSemua = bolehLihatSemua(peran);

  const whereSekolah: any = {};

  if (!lihatSemua) {
    whereSekolah.dipegangOleh = emailPengguna.toLowerCase();
  } else if (sales) {
    whereSekolah.dipegangOleh = sales;
  }

  if (q?.trim()) {
    whereSekolah.nama = { contains: q.trim() };
  }

  const wherePo: any = {};
  if (status && status.length > 0) {
    wherePo.status = { in: status as StatusPo[] };
  }
  if (sejak) {
    wherePo.dibuatPada = { ...(wherePo.dibuatPada || {}), gte: new Date(sejak) };
  }
  if (sampaiIso) {
    wherePo.dibuatPada = { ...(wherePo.dibuatPada || {}), lte: new Date(`${sampaiIso}T23:59:59`) };
  }

  const adaFilterPo = Object.keys(wherePo).length > 0;
  if (adaFilterPo) {
    whereSekolah.daftarPo = { some: wherePo };
  }

  const [count, rows] = await Promise.all([
    prisma.sekolah.count({ where: whereSekolah }),
    prisma.sekolah.findMany({
      where: whereSekolah,
      select: {
        id: true,
        nama: true,
        npsn: true,
        jenjang: true,
        kepalaSekolah: true,
        dipegangOleh: true,
        daftarPo: {
          select: {
            id: true,
            nomor: true,
            status: true,
            grandTotal: true,
            dibuatPada: true,
          },
          orderBy: { dibuatPada: 'desc' },
        },
      },
      orderBy: { nama: 'asc' },
      skip: dari,
      take: jumlah,
    }),
  ]);

  const daftar: BarisSekolah[] = rows.map((s) => ({
    id: s.id,
    nama: s.nama,
    npsn: s.npsn || null,
    jenjang: s.jenjang,
    kepala_sekolah: s.kepalaSekolah || null,
    dipegang_oleh: s.dipegangOleh,
    po: s.daftarPo.map((p) => ({
      id: p.id,
      nomor: Number(p.nomor),
      status: p.status,
      grand_total: Number(p.grandTotal),
      dibuat_pada: p.dibuatPada.toISOString(),
    })),
  }));

  return { count, daftar };
}

export async function ambilDetailSekolah(id: string, emailPengguna: string, peran: Peran[]) {
  const lihatSemua = bolehLihatSemua(peran);
  const where: any = { id };
  if (!lihatSemua) {
    where.dipegangOleh = emailPengguna.toLowerCase();
  }

  const s = await prisma.sekolah.findFirst({
    where,
    include: {
      daftarPo: {
        include: {
          riwayat: true,
          tandaTangan: true,
          verifikasi: true,
          suratVerifikasi: true,
          pks: true,
        },
        orderBy: { nomor: 'desc' },
      },
    },
  });

  if (!s) return null;

  return {
    id: s.id,
    nama: s.nama,
    npsn: s.npsn || null,
    jenjang: s.jenjang,
    alamat: s.alamat || null,
    telepon: s.telepon || null,
    email: s.email || null,
    kepala_sekolah: s.kepalaSekolah || null,
    kepsek_hp: s.kepsekHp || null,
    bendahara: s.bendahara || null,
    bendahara_hp: s.bendaharaHp || null,
    dipegang_oleh: s.dipegangOleh,
    po: s.daftarPo.map((p) => {
      const sv = p.suratVerifikasi?.[0];
      const pk = p.pks?.[0];
      return {
        id: p.id,
        nomor: Number(p.nomor),
        status: p.status,
        grand_total: Number(p.grandTotal),
        jumlah_siswa: p.jumlahSiswa,
        jumlah_guru: p.jumlahGuru,
        masa_mulai: p.masaMulai ? p.masaMulai.toISOString().slice(0, 10) : null,
        masa_selesai: p.masaSelesai ? p.masaSelesai.toISOString().slice(0, 10) : null,
        dibuat_oleh: p.dibuatOleh,
        dibuat_pada: p.dibuatPada.toISOString(),
        diverifikasi_oleh: p.diverifikasiOleh,
        diverifikasi_otomatis: p.diverifikasiOtomatis,
        skema_ttd: p.skemaTtd,
        dibaca_ai_pada: p.dibacaAiPada?.toISOString() ?? null,
        po_riwayat: p.riwayat.map((rw) => ({
          id: Number(rw.id),
          status_lama: rw.statusLama,
          status_baru: rw.statusBaru,
          versi: rw.versi,
          oleh: rw.oleh,
          pada: rw.pada.toISOString(),
        })),
        tanda_tangan: p.tandaTangan.map((t) => ({
          pihak: t.pihak,
          nama: t.nama,
          berkas: t.berkas,
          dibubuhkan_oleh: t.dibubuhkanOleh,
          waktu: t.waktu.toISOString(),
        })),
        verifikasi: p.verifikasi.map((v) => ({
          fungsi: v.fungsi,
          hasil: v.hasil,
          catatan: v.catatan,
          berlaku: v.berlaku,
          oleh: v.oleh,
          waktu: v.waktu.toISOString(),
        })),
        surat_verifikasi: sv ? {
          nama_penanda: sv.namaPenanda,
          ditandatangani_oleh: sv.ditandatanganiOleh,
          dibuat_pada: sv.dibuatPada.toISOString(),
          final_pada: sv.finalPada?.toISOString() ?? null,
          otomatis: sv.otomatis,
        } : null,
        pks: pk ? {
          dibuat_oleh: pk.dibuatOleh,
          dibuat_pada: pk.dibuatPada.toISOString(),
          final_pada: pk.finalPada?.toISOString() ?? null,
          diunggah_oleh: pk.diunggahOleh,
          diunggah_pada: pk.diunggahPada?.toISOString() ?? null,
          ditandatangani_pada: pk.ditandatanganiPada?.toISOString().slice(0, 10) ?? null,
        } : null,
      };
    }),
  };
}

