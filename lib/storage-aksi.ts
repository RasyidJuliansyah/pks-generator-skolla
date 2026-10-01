'use server';

import { penggunaSaatIni } from './sesi';
import { simpanBerkas } from './storage';

export async function unggahBerkasAksi(
  formData: FormData
): Promise<{ ok: boolean; jalur?: string; galat?: string }> {
  try {
    const user = await penggunaSaatIni();
    if (user.status !== 'ok') {
      return { ok: false, galat: 'Sesi tidak sah' };
    }

    const bucket = formData.get('bucket') as string;
    const jalur = formData.get('jalur') as string;
    const berkas = formData.get('berkas') as File | null;

    if (!bucket || !jalur || !berkas) {
      return { ok: false, galat: 'Data unggahan tidak lengkap' };
    }

    const arrayBuffer = await berkas.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await simpanBerkas(bucket, jalur, buffer);
    return { ok: true, jalur };
  } catch (err: unknown) {
    const pesan = err instanceof Error ? err.message : 'Gagal menyimpan berkas';
    return { ok: false, galat: pesan };
  }
}
