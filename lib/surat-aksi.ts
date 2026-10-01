'use server';

import { revalidatePath } from 'next/cache';
import prisma from './prisma';
import { adalahLead, penggunaSaatIni } from './sesi';
import { simpanBerkas, hapusBerkas } from './storage';

type Hasil = { ok: boolean; galat?: string };

/**
 * Surat untuk PO yang lolos verifikasi otomatis diterbitkan dan dikunci oleh sistem.
 */
const SURAT_OTOMATIS =
  'Surat PO ini diterbitkan otomatis oleh sistem, jadi tidak ada yang perlu ditandatangani '
  + 'atau difinalisasi.';

const jalurTtd = (poId: string) => `surat/${poId}.png`;

async function leadSaatIni() {
  const hasil = await penggunaSaatIni();
  if (hasil.status !== 'ok') return { galat: 'Sesi berakhir. Masuk lagi.' } as const;
  if (!adalahLead(hasil.pengguna.peran))
    return { galat: 'Hanya Tech Ops Lead yang menerbitkan Surat Verifikasi Kesiapan.' } as const;
  return { pengguna: hasil.pengguna } as const;
}

/** Membubuhkan tanda tangan Tech Ops Lead pada surat, sekaligus membuat
 *  suratnya bila belum ada. */
export async function simpanTtdSurat(poId: string, pngBase64: string): Promise<Hasil> {
  const p = await leadSaatIni();
  if ('galat' in p) return { ok: false, galat: p.galat };

  try {
    const po = await prisma.po.findUnique({
      where: { id: poId },
      select: { status: true, diverifikasiOtomatis: true },
    });
    if (!po) return { ok: false, galat: 'PO tidak ditemukan.' };
    if (po.status !== 'terverifikasi')
      return { ok: false, galat: 'Surat hanya bisa diterbitkan untuk PO yang sudah terverifikasi.' };
    if (po.diverifikasiOtomatis) return { ok: false, galat: SURAT_OTOMATIS };

    const ada = await prisma.suratVerifikasi.findFirst({
      where: { poId },
      select: { id: true, finalPada: true },
    });
    if (ada?.finalPada) return { ok: false, galat: 'Surat sudah difinalisasi dan tidak bisa diubah.' };

    const biner = Buffer.from(pngBase64.replace(/^data:image\/png;base64,/, ''), 'base64');
    if (biner.length > 512 * 1024) return { ok: false, galat: 'Berkas tanda tangan terlalu besar.' };

    const jalur = jalurTtd(poId);
    try {
      await simpanBerkas('tanda-tangan', jalur, biner);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Galat simpan';
      return { ok: false, galat: `Gagal mengunggah: ${msg}` };
    }

    const nama = p.pengguna.nama || p.pengguna.email;
    if (ada) {
      await prisma.suratVerifikasi.update({
        where: { id: ada.id },
        data: {
          ditandatanganiOleh: p.pengguna.email,
          namaPenanda: nama,
          berkas: jalur,
        },
      });
    } else {
      await prisma.suratVerifikasi.create({
        data: {
          poId,
          ditandatanganiOleh: p.pengguna.email,
          namaPenanda: nama,
          berkas: jalur,
        },
      });
    }

    revalidatePath(`/po/${poId}/surat`);
    revalidatePath('/surat');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: `Gagal menyimpan: ${msg}` };
  }
}

export async function hapusTtdSurat(poId: string): Promise<Hasil> {
  const p = await leadSaatIni();
  if ('galat' in p) return { ok: false, galat: p.galat };

  try {
    await hapusBerkas('tanda-tangan', jalurTtd(poId));
    await prisma.suratVerifikasi.deleteMany({ where: { poId } });

    revalidatePath(`/po/${poId}/surat`);
    revalidatePath('/surat');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

/** Mengunci surat. Setelah ini isinya tidak bisa diubah, dan PKS boleh dibuat. */
export async function finalisasiSurat(poId: string): Promise<Hasil> {
  const p = await leadSaatIni();
  if ('galat' in p) return { ok: false, galat: p.galat };

  try {
    const surat = await prisma.suratVerifikasi.findFirst({
      where: { poId },
      select: { id: true, berkas: true, finalPada: true, otomatis: true },
    });
    if (!surat) return { ok: false, galat: 'Surat belum ditandatangani.' };
    if (surat.otomatis) return { ok: false, galat: SURAT_OTOMATIS };
    if (surat.finalPada) return { ok: false, galat: 'Surat sudah difinalisasi.' };
    if (!surat.berkas) return { ok: false, galat: 'Tanda tangan Tech Ops Lead belum dibubuhkan.' };

    await prisma.suratVerifikasi.update({
      where: { id: surat.id },
      data: { finalPada: new Date() },
    });

    revalidatePath(`/po/${poId}/surat`);
    revalidatePath(`/po/${poId}`);
    revalidatePath('/surat');
    revalidatePath('/pks');
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}
