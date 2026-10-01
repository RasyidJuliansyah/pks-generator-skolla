'use client';

import { useRouter } from 'next/navigation';
import { keluarAksi } from '@/lib/auth-aksi';

export default function Keluar() {
  const router = useRouter();

  async function keluar() {
    await keluarAksi();
    router.push('/masuk');
    router.refresh();
  }

  return <button className="keluar" onClick={keluar} type="button">Keluar</button>;
}

