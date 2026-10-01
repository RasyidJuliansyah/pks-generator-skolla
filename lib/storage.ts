import fs from 'node:fs';
import path from 'node:path';

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

function jalurAman(bucket: string, jalur: string): string {
  // Cegah directory traversal
  const target = path.normalize(path.join(UPLOAD_DIR, bucket, jalur));
  if (!target.startsWith(UPLOAD_DIR)) {
    throw new Error('Jalur berkas tidak diizinkan');
  }
  return target;
}

export async function simpanBerkas(
  bucket: string,
  jalur: string,
  konten: Buffer | Uint8Array | ArrayBuffer
): Promise<string> {
  const target = jalurAman(bucket, jalur);
  const dir = path.dirname(target);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const buf = Buffer.isBuffer(konten)
    ? konten
    : konten instanceof ArrayBuffer
      ? Buffer.from(konten)
      : Buffer.from(konten.buffer, konten.byteOffset, konten.byteLength);
  await fs.promises.writeFile(target, buf);
  return jalur;
}

export async function bacaBerkas(bucket: string, jalur: string): Promise<Buffer | null> {
  try {
    const target = jalurAman(bucket, jalur);
    if (!fs.existsSync(target)) return null;
    return await fs.promises.readFile(target);
  } catch {
    return null;
  }
}

export async function hapusBerkas(bucket: string, jalur: string | string[]): Promise<boolean> {
  const daftar = Array.isArray(jalur) ? jalur : [jalur];
  for (const j of daftar) {
    try {
      const target = jalurAman(bucket, j);
      if (fs.existsSync(target)) {
        await fs.promises.unlink(target);
      }
    } catch {
      // Abaikan jika berkas sudah tidak ada
    }
  }
  return true;
}

export function urlBerkas(bucket: string, jalur: string): string {
  const cleanPath = jalur.startsWith('/') ? jalur.slice(1) : jalur;
  return `/api/berkas/${bucket}/${cleanPath}`;
}
