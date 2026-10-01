import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_SESI = 'skolla_sesi';
const JWT_SECRET = process.env.JWT_SECRET || 'skolla-kerjasama-secret-key-32-chars-min!!';
const KUNCI_RAHASIA = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(COOKIE_SESI)?.value;

  let isValid = false;
  if (token) {
    try {
      await jwtVerify(token, KUNCI_RAHASIA);
      isValid = true;
    } catch {
      isValid = false;
    }
  }

  // Jika membuka halaman login tapi sudah punya sesi valid, lempar ke beranda
  if (pathname === '/masuk' || pathname === '/') {
    if (isValid) {
      return NextResponse.redirect(new URL('/beranda', request.url));
    }
    return NextResponse.next();
  }

  // Jika tidak punya sesi valid dan mencoba akses rute internal
  if (!isValid) {
    const respon = NextResponse.redirect(new URL('/masuk', request.url));
    if (token) {
      respon.cookies.delete(COOKIE_SESI);
    }
    return respon;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.svg|api/berkas|.*\\.(?:svg|png|jpg|webp)$).*)'],
};

