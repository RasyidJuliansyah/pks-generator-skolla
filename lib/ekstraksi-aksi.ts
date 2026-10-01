'use server';

import prisma from './prisma';
import { penggunaSaatIni } from './sesi';
import { bacaScan, MODEL_EKSTRAKSI } from './penyedia-ekstraksi';
import { Prisma } from '@prisma/client';

export type HasilBaca =
  | { ok: true; klaimId: string; hasil: unknown }
  | { ok: false; galat: string };

function peranPembuatPo(peran: string[]): boolean {
  return peran.some((p) => ['sales', 'head_of_sales', 'admin_sales', 'admin_utama'].includes(p));
}

function milikSales(dibuatOleh: string, pengguna: { email: string; peran: string[] }): boolean {
  if (pengguna.peran.some((p) => ['head_of_sales', 'admin_sales', 'admin_utama'].includes(p))) {
    return true;
  }
  return pengguna.peran.includes('sales') && dibuatOleh.toLowerCase() === pengguna.email.toLowerCase();
}

export async function bacaScanPo(gambar: string[]): Promise<HasilBaca> {
  if (!Array.isArray(gambar) || gambar.length === 0) {
    return { ok: false, galat: 'Tidak ada halaman yang bisa dibaca.' };
  }
  const bobot = gambar.reduce((a, g) => a + g.length, 0);
  if (bobot > 900_000) return { ok: false, galat: 'Gambar scan terlalu besar untuk dikirim.' };

  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };
  if (!peranPembuatPo(sesi.pengguna.peran)) {
    return { ok: false, galat: 'Hanya Sales yang boleh membaca scan.' };
  }

  const peng = await prisma.pengaturanEkstraksi.findFirst({
    orderBy: { id: 'desc' },
  });
  if (!peng?.menyala) {
    return { ok: false, galat: 'Pembacaan scan dengan AI belum dinyalakan. Ketik seperti biasa.' };
  }

  const now = new Date();
  const jktDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(now);
  const startOfDay = new Date(`${jktDateStr}T00:00:00+07:00`);
  const endOfDay = new Date(`${jktDateStr}T23:59:59.999+07:00`);

  const jumlahHariIni = await prisma.ekstraksiPo.count({
    where: {
      diklaimOleh: sesi.pengguna.email.toLowerCase(),
      diklaimPada: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
  });
  if (jumlahHariIni >= 20) {
    return { ok: false, galat: 'Batas 20 pembacaan scan per hari sudah tercapai. Ketik seperti biasa.' };
  }

  // Bersihkan hasil klaim lebih dari 24 jam yang belum ditautkan
  const batas24Jam = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.ekstraksiPo.updateMany({
    where: {
      poId: null,
      hasil: { not: Prisma.DbNull },
      selesaiPada: { lt: batas24Jam },
    },
    data: {
      hasil: Prisma.DbNull,
    },
  }).catch(() => {});

  const klaim = await prisma.ekstraksiPo.create({
    data: {
      diklaimOleh: sesi.pengguna.email.toLowerCase(),
      dicentangOleh: sesi.pengguna.email.toLowerCase(),
      model: MODEL_EKSTRAKSI,
    },
  });
  const klaimId = klaim.id;

  const mulai = Date.now();
  try {
    const { hasil, tokenMasuk, tokenKeluar } = await bacaScan(gambar);
    await prisma.ekstraksiPo.update({
      where: { id: klaimId },
      data: {
        selesaiPada: new Date(),
        berhasil: true,
        hasil: hasil as Prisma.InputJsonValue,
        galat: null,
        durasiMs: Date.now() - mulai,
        tokenMasuk: tokenMasuk ?? null,
        tokenKeluar: tokenKeluar ?? null,
      },
    });
    return { ok: true, klaimId, hasil };
  } catch (e) {
    const pesan = e instanceof Error ? e.message : 'Pembacaan gagal.';
    await prisma.ekstraksiPo.update({
      where: { id: klaimId },
      data: {
        selesaiPada: new Date(),
        berhasil: false,
        hasil: Prisma.DbNull,
        galat: pesan,
        durasiMs: Date.now() - mulai,
      },
    });
    return { ok: false, galat: pesan };
  }
}

export async function tautkanEkstraksi(klaimId: string, poId: string): Promise<{ ok: boolean; galat?: string }> {
  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };

  const email = sesi.pengguna.email.toLowerCase();
  const klaim = await prisma.ekstraksiPo.findUnique({ where: { id: klaimId } });
  if (!klaim) return { ok: false, galat: 'Pembacaan tidak ditemukan.' };
  if (klaim.diklaimOleh !== email) return { ok: false, galat: 'Pembacaan ini bukan milikmu.' };
  if (!klaim.berhasil) return { ok: false, galat: 'Pembacaan ini tidak berhasil.' };
  if (klaim.poId) return { ok: false, galat: 'Pembacaan ini sudah tertaut ke PO lain.' };
  if (!klaim.hasil) return { ok: false, galat: 'Hasil pembacaan sudah dibuang.' };

  const po = await prisma.po.findUnique({ where: { id: poId } });
  if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };
  if (!milikSales(po.dibuatOleh, sesi.pengguna)) return { ok: false, galat: 'PO ini bukan milikmu.' };
  if (po.asal !== 'unggahan') return { ok: false, galat: 'Jalur ini hanya untuk PO unggahan.' };
  if (!['draf', 'ditolak'].includes(po.status)) return { ok: false, galat: 'PO ini sudah keluar dari draf.' };
  if (po.dibacaAiPada) return { ok: false, galat: 'PO ini sudah punya pembacaan.' };

  await prisma.$transaction([
    prisma.ekstraksiPo.update({
      where: { id: klaimId },
      data: { poId },
    }),
    prisma.po.update({
      where: { id: poId },
      data: { dibacaAiPada: klaim.selesaiPada ?? new Date() },
    }),
  ]);

  return { ok: true };
}
