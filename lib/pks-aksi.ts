'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import { penggunaSaatIni, type Peran } from './sesi';
import { urlBerkas } from './storage';

type Hasil = { ok: boolean; galat?: string };

const ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

function milikSales(dibuatOleh: string, pengguna: { email: string; peran: Peran[] }) {
  if (pengguna.peran.some((p) => ['head_of_sales', 'admin_sales', 'admin_utama'].includes(p))) {
    return true;
  }
  return pengguna.peran.includes('sales') && dibuatOleh.toLowerCase() === pengguna.email.toLowerCase();
}

function segarkan(poId: string) {
  revalidatePath(`/po/${poId}`);
  revalidatePath(`/pks/${poId}`);
  revalidatePath('/pks');
  revalidatePath('/po');
}

/**
 * Memesan nomor PKS dan membuat drafnya.
 */
export async function buatPks(poId: string): Promise<Hasil & { nomor?: string }> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      include: {
        suratVerifikasi: true,
        pks: true,
      },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan' };

    if (!milikSales(po.dibuatOleh, p.pengguna)) {
      return { ok: false, galat: 'Hanya sales pemilik PO yang bisa membuat PKS' };
    }
    if (po.status !== 'terverifikasi') {
      return { ok: false, galat: 'PO belum terverifikasi' };
    }
    const suratFinal = po.suratVerifikasi.find((s) => s.finalPada !== null);
    if (!suratFinal) {
      return { ok: false, galat: 'Surat Verifikasi Kesiapan belum difinalisasi' };
    }
    if (po.pks.length > 0) {
      return { ok: false, galat: 'PKS untuk PO ini sudah ada' };
    }

    const now = new Date();
    const thn = now.getFullYear();
    const bln = now.getMonth() + 1;

    await prisma.pks.create({
      data: {
        poId,
        tahun: thn,
        bulan: bln,
        dibuatOleh: p.pengguna.email,
      },
    });

    const nomor = `/EXTSKOLLA/PKS/${ROMAWI[bln - 1]}/${thn}`;
    segarkan(poId);
    return { ok: true, nomor };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat membuat PKS';
    return { ok: false, galat: msg };
  }
}

/**
 * Mengunci PKS dan menaikkan status PO menjadi pks_terbit.
 */
export async function finalisasiPks(poId: string): Promise<Hasil> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      include: { pks: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan' };
    if (!milikSales(po.dibuatOleh, p.pengguna)) {
      return { ok: false, galat: 'Hanya sales pemilik PO yang bisa memfinalisasi PKS' };
    }

    const pks = po.pks[0];
    if (!pks || pks.finalPada !== null) {
      return { ok: false, galat: 'PKS belum dibuat atau sudah difinalisasi' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.pks.update({
        where: { id: pks.id },
        data: { finalPada: new Date() },
      });
      await tx.po.update({
        where: { id: poId },
        data: { status: 'pks_terbit' },
      });
    });

    segarkan(poId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat memfinalisasi PKS';
    return { ok: false, galat: msg };
  }
}

/**
 * Mencatat pindaian PKS bermeterai yang sudah diunggah ke penyimpanan.
 */
export async function catatUnggahanPks(
  poId: string, jalur: string, tanggal: string
): Promise<Hasil> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };
  if (!tanggal) return { ok: false, galat: 'Tanggal penandatanganan belum diisi.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      include: {
        pks: true,
        catatan: true,
        dokumenSponsorship: true,
      },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan' };
    if (!milikSales(po.dibuatOleh, p.pengguna)) {
      return { ok: false, galat: 'Hanya sales pemilik PO yang bisa mengunggah PKS' };
    }

    if (!jalur || !jalur.startsWith(`${poId}/`)) {
      return { ok: false, galat: 'Berkas harus berada di folder PO ini' };
    }

    const pks = po.pks[0];
    if (!pks) return { ok: false, galat: 'PKS belum dibuat' };
    if (!pks.finalPada) return { ok: false, galat: 'PKS belum difinalisasi' };

    const tgl = new Date(tanggal);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (tgl > today) {
      return { ok: false, galat: 'Tanggal penandatanganan tidak boleh di masa depan' };
    }

    const catSponsor = po.catatan.some((c) => c.jenis === 'sponsorship' && c.isi.trim() !== '');
    const nilaiSponsor = po.nilaiSponsorship ? Number(po.nilaiSponsorship) : 0;
    const vSponsor = catSponsor || nilaiSponsor > 0;

    if (vSponsor) {
      const doc = po.dokumenSponsorship;
      const valid = doc &&
        doc.versiPo === po.versi &&
        doc.formDitandatangani &&
        doc.rekeningAtasNamaLembaga &&
        doc.meteraiBilaDiAtas5juta;
      if (!valid) {
        return {
          ok: false,
          galat: 'PO ini bersponsorship. Finance harus mengonfirmasi dokumen sponsorship '
            + 'untuk versi PO sekarang sebelum PKS bertanda tangan basah bisa diunggah.',
        };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.pks.update({
        where: { id: pks.id },
        data: {
          berkasBasah: jalur,
          diunggahOleh: p.pengguna.email.toLowerCase(),
          diunggahPada: new Date(),
          ditandatanganiPada: tgl,
        },
      });
      await tx.po.update({
        where: { id: poId },
        data: { status: 'pks_ditandatangani' },
      });
    });

    segarkan(poId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat mencatat unggahan PKS';
    return { ok: false, galat: msg };
  }
}

/** URL berkas internal untuk dokumen PKS basah. */
export async function urlPksBasah(jalur: string): Promise<string | null> {
  return urlBerkas('pks-basah', jalur);
}

/** Membatalkan draf PKS. Nomornya tidak dipakai ulang. */
export async function batalkanPks(poId: string): Promise<Hasil> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      include: { pks: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan' };
    if (!milikSales(po.dibuatOleh, p.pengguna)) {
      return { ok: false, galat: 'Hanya sales pemilik PO yang bisa membatalkan PKS' };
    }

    const pks = po.pks[0];
    if (!pks || pks.finalPada !== null) {
      return { ok: false, galat: 'PKS sudah difinalisasi atau tidak ditemukan' };
    }

    await prisma.pks.delete({
      where: { id: pks.id },
    });

    segarkan(poId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat membatalkan PKS';
    return { ok: false, galat: msg };
  }
}

/**
 * Konfirmasi Finance bahwa dokumen sponsorship sebuah PO sudah beres.
 */
export async function simpanDokumenSponsorship(
  poId: string, versiPo: number,
  centang: { form: boolean; rekening: boolean; meterai: boolean },
): Promise<Hasil> {
  const p = await penggunaSaatIni();
  if (p.status !== 'ok') return { ok: false, galat: 'Sesi berakhir. Masuk lagi.' };

  const boleh = p.pengguna.peran.some((r) => ['finance', 'admin_utama'].includes(r));
  if (!boleh) {
    return {
      ok: false,
      galat: 'Hanya Finance yang bisa mengonfirmasi dokumen sponsorship, '
        + 'dan konfirmasinya harus untuk versi PO yang sekarang. Muat ulang halaman ini.',
    };
  }

  try {
    const po = await prisma.po.findUnique({ where: { id: poId }, select: { versi: true } });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan' };
    if (po.versi !== versiPo) {
      return {
        ok: false,
        galat: 'Versi PO sudah berubah. Muat ulang halaman ini.',
      };
    }

    await prisma.pksDokumenSponsorship.upsert({
      where: { poId },
      create: {
        poId,
        versiPo,
        formDitandatangani: centang.form,
        rekeningAtasNamaLembaga: centang.rekening,
        meteraiBilaDiAtas5juta: centang.meterai,
        oleh: p.pengguna.email,
      },
      update: {
        versiPo,
        formDitandatangani: centang.form,
        rekeningAtasNamaLembaga: centang.rekening,
        meteraiBilaDiAtas5juta: centang.meterai,
        oleh: p.pengguna.email,
        pada: new Date(),
      },
    });

    segarkan(poId);
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat menyimpan dokumen sponsorship';
    return { ok: false, galat: msg };
  }
}
