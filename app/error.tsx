'use client'

// Menangkap galat di atas app/(sistem)/error.tsx: layout sistem sendiri (cek
// pengguna, hitung komentar) dan halaman di luar sistem. Tampil tanpa sidebar.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <main className="tengah">
      <div className="kartu" role="alert">
        <p className="eyebrow">Skolla</p>
        <h1>Halaman gagal dimuat</h1>
        <p className="muted">Server tidak berhasil mengambil datanya. Coba lagi. Kalau terus terjadi, kabari Super Admin beserta kode di bawah.</p>
        <button type="button" className="tombol" onClick={() => retry()}>Coba lagi</button>
        {error.digest && <p className="muted">Kode: {error.digest}</p>}
      </div>
    </main>
  )
}
