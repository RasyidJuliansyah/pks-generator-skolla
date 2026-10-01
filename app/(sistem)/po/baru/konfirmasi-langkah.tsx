'use client';

/**
 * Penanda "dari scan, periksa" dan tombol konfirmasi langkah (catatan/17 amandemen 2).
 *
 * Dipakai kelima langkah; langkah yang tidak punya isian dari scan tidak memanggilnya sama sekali.
 * `kunci.length` sengaja dibaca dari sisa yang TERSIMPAN, bukan dari hasil baca, supaya penandanya
 * tetap muncul saat draf dibuka lagi -- di sana hasil bacanya sudah tidak ada di peramban.
 */
import type { KodeLangkah } from '@/lib/langkah-po';
import { HP_KEYS, labelKunci } from '@/lib/ekstraksi-po';
import type { PropsLangkah } from './use-form-po';

export default function KonfirmasiLangkah({ f, langkah, label }: {
  f: PropsLangkah['f']; langkah: KodeLangkah; label: string;
}) {
  // Tanpa satu pun penanda dari scan, langkah ini tidak butuh tombol konfirmasi.
  if (!f.sisa.length) return null;
  const kunci = f.kunciLangkah(langkah);
  if (!kunci.length) return null;
  const terkunci = f.terkunciRisiko(langkah);
  // Nomor HP dicentang DI SAMPING isiannya (langkah Sekolah); sisanya -- isian yang ditandai ragu
  // atau tidak terbaca -- dicentang di sini, karena isiannya bisa ada di langkah mana saja dan
  // tabel/deret tanggal tidak punya tempat yang jelas untuk menempelkan centang.
  const diSini = terkunci.filter((k) => !(HP_KEYS as readonly string[]).includes(k));

  return (
    <div className="kotak" style={{ padding: '12px 16px', marginTop: 12 }}>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {kunci.length} isian di langkah ini datang dari hasil baca scan. Periksa terhadap pindaiannya.
      </p>
      {terkunci.length > 0 && (
        <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
          Yang wajib dicentang dulu:{' '}
          {terkunci.map((k) => labelKunci(k)).join(', ')}.
        </p>
      )}
      {diSini.length > 0 && (
        <ul style={{ listStyle: 'none', margin: '4px 0 0', padding: 0 }}>
          {diSini.map((k) => (
            <li key={k}>
              <label className="baris" style={{ padding: '4px 0' }}>
                <input type="checkbox" checked={false}
                  onChange={() => f.centang(k)}
                  aria-label={`${labelKunci(k)} sudah saya periksa`} />
                <span className="meta">
                  {labelKunci(k)} sudah saya bandingkan dengan pindaiannya
                  {f.ekstraksi?.tidakTerbaca.includes(k) ? ' (atau memang kosong di kertas)' : ''}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      <button className="tombol" type="button" disabled={terkunci.length > 0}
        style={{ marginTop: 10 }} onClick={() => f.konfirmasiLangkah(langkah)}>
        Saya sudah mencocokkan isian langkah {label} dengan scan
      </button>
    </div>
  );
}
