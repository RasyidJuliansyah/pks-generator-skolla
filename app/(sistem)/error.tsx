'use client'

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  return (
    <div className="panel" role="alert">
      <h2>Halaman ini gagal dimuat</h2>
      <p className="muted">Server tidak berhasil mengambil datanya. Coba lagi. Kalau terus terjadi, kabari Super Admin beserta kode di bawah.</p>
      <button type="button" className="tombol" style={{ width: 'auto' }} onClick={() => retry()}>Coba lagi</button>
      {error.digest && <p className="muted">Kode: {error.digest}</p>}
    </div>
  )
}
