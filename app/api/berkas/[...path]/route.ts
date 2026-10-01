import { NextRequest, NextResponse } from 'next/server';
import path from 'node:path';
import { bacaBerkas } from '@/lib/storage';
import { bacaSesiToken, COOKIE_SESI } from '@/lib/auth';

const MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const token = request.cookies.get(COOKIE_SESI)?.value;
  if (!token) {
    return new NextResponse('Tidak diizinkan', { status: 401 });
  }

  const sesi = await bacaSesiToken(token);
  if (!sesi?.id) {
    return new NextResponse('Sesi tidak valid', { status: 401 });
  }

  const { path: segments } = await context.params;
  if (!segments || segments.length < 2) {
    return new NextResponse('Jalur berkas tidak valid', { status: 400 });
  }

  const bucket = segments[0];
  const jalur = segments.slice(1).join('/');

  const konten = await bacaBerkas(bucket, jalur);
  if (!konten) {
    return new NextResponse('Berkas tidak ditemukan', { status: 404 });
  }

  const ext = path.extname(jalur).toLowerCase();
  const contentType = MIME_MAP[ext] || 'application/octet-stream';

  return new NextResponse(new Uint8Array(konten), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
