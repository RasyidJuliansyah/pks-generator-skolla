import Link from 'next/link';
import { rp } from '@/lib/format';
import { liniMasa, type Peristiwa, type SumberLiniMasa } from '@/lib/lini-masa';
import { satu } from '@/lib/relasi';
import { TAHAP_PO, TAHAP_PKS } from '@/lib/status-po';

const LABEL = Object.fromEntries([...TAHAP_PO, ...TAHAP_PKS].map((s) => [s.kode, s]));
const tgl = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';

export type PoRiwayat = {
  id: string; nomor: number; status: string; grand_total: number;
  jumlah_siswa: number; jumlah_guru: number;
  masa_mulai: string | null; masa_selesai: string | null;
  dibuat_oleh: string; dibuat_pada: string; diverifikasi_oleh: string | null;
  /** Ditutup basis data, bukan oleh orang: `diverifikasi_oleh` sengaja kosong. */
  diverifikasi_otomatis: boolean;
  /** Isian awalnya dibaca AI dari pindaian (catatan/17). */
  dibaca_ai_pada?: string | null;
  po_riwayat: SumberLiniMasa['riwayat'];
  tanda_tangan: SumberLiniMasa['ttd'];
  /** Tanpa ini tanda tangan Head of Sales PO skema 4 terbaca Sales Manager (catatan/23). */
  skema_ttd?: number | null;
  verifikasi: SumberLiniMasa['verifikasi'];
  surat_verifikasi: SumberLiniMasa['surat'];
  pks: (SumberLiniMasa['pks'] & { ditandatangani_pada: string | null }) | null;
};

/**
 * Riwayat kerja sama satu sekolah: satu kartu per PO, masing-masing memuat lini
 * masanya sendiri.
 *
 * Dipisah dari halamannya supaya markup yang sama bisa dirender di luar sesi
 * login dan diperiksa mata lewat uji/pratinjau-sekolah.tsx. Kartu KPI di halaman
 * ini pernah dikirim dengan label dan angka menempel sebaris karena tidak pernah
 * benar-benar dilihat sebelum tayang.
 */
export default function RiwayatKerjaSama({ po }: { po: PoRiwayat[] }) {
  return (
      <div className="po-riwayat-kisi">
        {po.map((p, urutan) => {
          const peristiwa: Peristiwa[] = liniMasa({
            riwayat: p.po_riwayat ?? [],
            ttd: p.tanda_tangan ?? [],
            skema: p.skema_ttd,
            verifikasi: p.verifikasi ?? [],
            surat: satu(p.surat_verifikasi),
            pks: satu(p.pks),
            otomatis: p.diverifikasi_otomatis,
            dibacaAiPada: p.dibaca_ai_pada,
          });
          return (
            <article className="po-riwayat-kartu" key={p.id}>
              <div className="po-riwayat-kepala">
                <span className={`lini-titik w-${LABEL[p.status]?.warna ?? 'muted'}`}
                  aria-hidden="true" />
                <Link href={`/po/${p.id}`} className="lini-judul">
                  PO-{String(p.nomor).padStart(3, '0')}
                </Link>
                <span className="po-riwayat-status">
                  {LABEL[p.status]?.label ?? p.status}
                </span>
                <span className="po-riwayat-nilai">{rp(p.grand_total)}</span>
              </div>
              <div className="lini-rincian">
                {p.jumlah_siswa} siswa
                {p.jumlah_guru > 0 ? ` dan ${p.jumlah_guru} guru` : ''}
                {p.masa_mulai ? ` · masa aktif ${tgl(p.masa_mulai)} – ${tgl(p.masa_selesai)}` : ''}
              </div>
              <div className="ttd-waktu">
                dibuat {p.dibuat_oleh.split('@')[0]} {tgl(p.dibuat_pada)}
                {/* PO otomatis tidak punya `diverifikasi_oleh` — dan memang tidak boleh
                    dicetak seolah ada orang yang memutuskan. */}
                {p.diverifikasi_otomatis
                  ? ' · diverifikasi otomatis oleh sistem'
                  : p.diverifikasi_oleh && ` · diverifikasi ${p.diverifikasi_oleh.split('@')[0]}`}
                {p.pks?.ditandatangani_pada
                  && ` · PKS bermeterai ${tgl(p.pks.ditandatangani_pada)}`}
              </div>

              {/* PO terbaru terbuka, yang lama terlipat: halaman ini dibaca
                  untuk yang sedang berjalan, sementara yang lama cuma perlu
                  ada saat ditanyakan. */}
              {peristiwa.length > 0 && (
                <details className="riwayat" open={urutan === 0}>
                  <summary>Riwayat PO-{String(p.nomor).padStart(3, '0')} ({peristiwa.length} peristiwa)</summary>
                  <ol className="lini-masa" style={{ padding: '0 16px 14px' }}>
                    {peristiwa.map((e, i) => (
                      <li key={i}>
                        <span className={`lini-titik w-${e.warna}`} aria-hidden="true" />
                        <div>
                          <div className="lini-judul">{e.judul}</div>
                          {e.rincian && <div className="lini-rincian">{e.rincian}</div>}
                          <div className="ttd-waktu">
                            {e.oleh ? `${e.oleh.split('@')[0]} · ` : ''}
                            {new Date(e.waktu).toLocaleString('id-ID',
                              { dateStyle: 'medium', timeStyle: 'short' })}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </article>
          );
        })}
      </div>
  );
}
