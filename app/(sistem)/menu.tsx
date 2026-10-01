'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type ItemMenu = { label: string; ke: string; ikon: string; lencana?: number };

const IKON: Record<string, React.ReactNode> = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
  analitik: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  po: <><path d="M9 3h6l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M15 3v4h4M9 13l2 2 4-4" /></>,
  antrean: <><path d="M4 6h16M4 12h16M4 18h10" /><circle cx="19" cy="18" r="2.5" /></>,
  sekolah: <><path d="M3 21h18" /><path d="M5 21V9l7-5 7 5v12" /><path d="M10 21v-5h4v5" /><path d="M9 12h1M14 12h1" /></>,
  surat: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
  // Dokumen bermeterai dan bertanda tangan — PKS ditandatangani basah.
  pks: <><path d="M7 3h7l5 5v6" /><path d="M7 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /><path d="M14 3v5h5" /><path d="M13 21c1.5-1 2-2.5 2-4s.8-2.6 2-2.6 2 1 2 2.3-1 2.3-2.4 2.3H13Z" /></>,
  pengguna: <><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M17 11h4M19 9v4" /></>,
  // Berkas dengan jam — masa simpan yang habis, bukan orang.
  retensi: <><path d="M8 3h6l4 4v6" /><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /><path d="M14 3v5h5" /><circle cx="17.5" cy="17.5" r="3.5" /><path d="M17.5 16v1.8l1.2.9" /></>,
  // Kertas yang dipindai: bingkai dengan garis pindai di tengahnya.
  ekstraksi: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M7 8h10M7 12h6" /><path d="M7 16h10" /><path d="M2 12h20" /></>,
};

export default function Menu({ item }: { item: ItemMenu[] }) {
  const path = usePathname();
  return (
    <nav className="menu" aria-label="Navigasi utama">
      {item.map((m) => {
        const aktif = path === m.ke || (m.ke !== '/beranda' && path.startsWith(m.ke));
        return (
          <Link key={m.ke} href={m.ke} className="menu-item" aria-current={aktif ? 'page' : undefined}>
            <svg viewBox="0 0 24 24" aria-hidden="true">{IKON[m.ikon]}</svg>
            <span>{m.label}</span>
            {!!m.lencana && (
              <span className="hitung-baru">
                <span aria-hidden="true">{m.lencana}</span>
                <span className="sr">, {m.lencana} komentar belum dibaca</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
