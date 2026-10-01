'use server';

import prisma from './prisma';
import { penggunaSaatIni, adalahSuperAdmin } from './sesi';

export type IsianGerbang = {
  menyala: boolean; penyedia: string; paketAkun: string; model: string;
  pemeriksaanData: string; risikoDiterimaOleh: string; alasanRisiko: string;
};

export async function simpanGerbang(i: IsianGerbang): Promise<{ ok: boolean; galat?: string }> {
  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };
  if (!adalahSuperAdmin(sesi.pengguna.peran)) {
    return { ok: false, galat: 'Hanya Super Admin yang boleh mengubah gerbang ini.' };
  }

  if (i.menyala && (!i.risikoDiterimaOleh.trim() || !i.alasanRisiko.trim())) {
    return { ok: false, galat: 'Menyalakan gerbang membutuhkan penerima risiko dan alasan risiko.' };
  }

  try {
    await prisma.pengaturanEkstraksi.create({
      data: {
        menyala: i.menyala,
        penyedia: i.penyedia.trim() || null,
        paketAkun: i.paketAkun.trim() || null,
        model: i.model.trim() || null,
        pemeriksaanData: i.pemeriksaanData.trim() || null,
        risikoDiterimaOleh: i.risikoDiterimaOleh.trim() || null,
        alasanRisiko: i.alasanRisiko.trim() || null,
        diubahOleh: sesi.pengguna.email.toLowerCase(),
      },
    });
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}

export async function gerbangEkstraksiMenyala(): Promise<boolean> {
  const baris = await prisma.pengaturanEkstraksi.findFirst({
    orderBy: { id: 'desc' },
    select: { menyala: true },
  });
  return baris?.menyala ?? false;
}


/**
 * Isi mentah satu pembacaan, HANYA saat diminta.
 */
export async function bukaHasil(id: string): Promise<{ ok: boolean; hasil?: string; galat?: string }> {
  const sesi = await penggunaSaatIni();
  if (sesi.status !== 'ok') return { ok: false, galat: 'Sesi tidak dikenali. Masuk ulang.' };
  if (!adalahSuperAdmin(sesi.pengguna.peran)) {
    return { ok: false, galat: 'Hanya Super Admin yang boleh membaca hasil mentah.' };
  }

  try {
    const data = await prisma.ekstraksiPo.findUnique({
      where: { id },
      select: { hasil: true },
    });
    if (!data) return { ok: false, galat: 'Pembacaan tidak ditemukan.' };
    return { ok: true, hasil: JSON.stringify(data.hasil, null, 2) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Galat basis data';
    return { ok: false, galat: msg };
  }
}
