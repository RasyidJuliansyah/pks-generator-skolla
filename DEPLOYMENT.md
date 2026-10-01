# Panduan Deployment PKS Generator (Prisma + MySQL)

Aplikasi telah sepenuhnya dimigrasi dari Supabase ke **Prisma ORM + MySQL** dengan otentikasi JWT HttpOnly lokal (bcrypt) dan penyimpanan berkas lokal/volume.

---

## 1. Persyaratan Sistem
- Node.js 20+ (atau Docker Engine & Docker Compose)
- MySQL Server 8.0+

---

## 2. Variabel Lingkungan (`.env`)

Buat file `.env` di server/lingkungan produksi:

```env
# Koneksi Database MySQL
DATABASE_URL="mysql://pks_user:pkspassword@localhost:3306/pks_generator"

# Kunci Rahasia JWT (Minimal 32 karakter acak)
JWT_SECRET="ganti-dengan-kunci-rahasia-yang-sangat-kuat-dan-panjang-min-32-karakter"

# Direktori Penyimpanan Berkas Lokal (Tanda tangan, PKS basah, PDF unggahan)
STORAGE_DIR="./storage-uploads"

# Domain Email Organisasi yang Diizinkan Masuk
NEXT_PUBLIC_DOMAIN_WAJIB="skolla.education"

# Opsional: API Key Ekstraksi AI (DeepSeek OCR)
DEEPSEEK_API_KEY=""
```

---

## 3. Inisialisasi Database

### Opsi A: Menggunakan Script SQL
Jalankan skrip `skema-mysql.sql` ke database MySQL Anda:
```bash
mysql -u root -p pks_generator < skema-mysql.sql
```

### Opsi B: Menggunakan Prisma CLI
```bash
npx prisma generate
npx prisma db push
```

### Akun Awal Default (Super Admin)
Skrip inisialisasi menyertakan akun awal:
- **Email:** `admin@skolla.education`
- **Password:** `Admin123!`
- **Peran:** `admin_utama`

---

## 4. Cara Menjalankan

### Cara 1: Menggunakan Docker Compose (Direkomendasikan)
1. Jalankan stack:
   ```bash
   docker compose up -d --build
   ```
2. Cek status container:
   ```bash
   docker compose ps
   ```
3. Aplikasi siap diakses di `http://localhost:3000`.

### Cara 2: Manual (Host / VPS / PM2)
1. Install dependensi:
   ```bash
   npm install --include=dev
   ```
2. Build aplikasi:
   ```bash
   npx prisma generate
   npm run build
   ```
3. Jalankan server produksi:
   ```bash
   # Standalone server
   node .next/standalone/server.js
   # atau via npm
   npm start
   ```

---

## 5. Pemeriksaan & Pengujian (Quality Gate)
Sebelum rilis atau commit:
```bash
npm run periksa
npm run build
```
- `npm run periksa` menjalankan TypeScript check dan seluruh 44 test suite.
- `npm run build` memvalidasi bundling Next.js dan pemindaian keamanan bundel klien.
