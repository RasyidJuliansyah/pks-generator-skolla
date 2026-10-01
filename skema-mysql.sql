-- =============================================================================
-- Skema Database MySQL untuk Skolla Kerjasama Sekolah
-- Dikonversi dari skema PostgreSQL / Supabase
-- Target Engine: MySQL 8.0+ / InnoDB / utf8mb4
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `skolla_kerjasama` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `skolla_kerjasama`;

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. Tabel Pengguna & Riwayat
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pengguna_riwayat`;
DROP TABLE IF EXISTS `pengguna`;

CREATE TABLE `pengguna` (
  `id` VARCHAR(36) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password` VARCHAR(255) NOT NULL DEFAULT '',
  `nama` VARCHAR(255) NULL,
  `peran` JSON NOT NULL COMMENT 'Array JSON string dari peran pengguna',
  `aktif` BOOLEAN NOT NULL DEFAULT TRUE,
  `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_pengguna_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pengguna_riwayat` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(191) NOT NULL,
  `aksi` VARCHAR(50) NOT NULL,
  `peran_lama` JSON NULL,
  `peran_baru` JSON NULL,
  `nama_lama` VARCHAR(255) NULL,
  `nama_baru` VARCHAR(255) NULL,
  `aktif_lama` BOOLEAN NULL,
  `aktif_baru` BOOLEAN NULL,
  `oleh` VARCHAR(191) NULL,
  `pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_pengguna_riwayat_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. Master Data Sekolah
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `sekolah`;

CREATE TABLE `sekolah` (
  `id` VARCHAR(36) NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `npsn` VARCHAR(50) NOT NULL,
  `jenjang` ENUM('SD', 'SMP', 'SMA') NOT NULL,
  `alamat` TEXT NOT NULL,
  `telepon` VARCHAR(50) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `kepala_sekolah` VARCHAR(255) NOT NULL,
  `kepsek_hp` VARCHAR(50) NOT NULL,
  `bendahara` VARCHAR(255) NOT NULL,
  `bendahara_hp` VARCHAR(50) NOT NULL,
  `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `diubah_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `dipegang_oleh` VARCHAR(191) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sekolah_npsn` (`npsn`),
  KEY `idx_sekolah_dipegang_oleh` (`dipegang_oleh`),
  CONSTRAINT `fk_sekolah_dipegang_oleh` FOREIGN KEY (`dipegang_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. Pre-Order (PO) & Relasi Anak
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `po_termin`;
DROP TABLE IF EXISTS `po_rombel`;
DROP TABLE IF EXISTS `po_komponen`;
DROP TABLE IF EXISTS `po_catatan`;
DROP TABLE IF EXISTS `po_kelompok`;
DROP TABLE IF EXISTS `po_riwayat`;
DROP TABLE IF EXISTS `po_pengecualian`;
DROP TABLE IF EXISTS `po`;

CREATE TABLE `po` (
  `id` VARCHAR(36) NOT NULL,
  `nomor` BIGINT NOT NULL,
  `sekolah_id` VARCHAR(36) NOT NULL,
  `dibuat_oleh` VARCHAR(191) NOT NULL,
  `status` ENUM(
    'draf', 'menunggu_ttd', 'ditandatangani', 'verifikasi', 'ditolak',
    'terverifikasi', 'pks_terbit', 'pks_ditandatangani', 'aktif', 'selesai'
  ) NOT NULL DEFAULT 'draf',
  `versi` INT NOT NULL DEFAULT 1,
  `jumlah_siswa` INT NOT NULL DEFAULT 0,
  `jumlah_guru` INT NOT NULL DEFAULT 0,
  `harga_siswa` BIGINT NOT NULL DEFAULT 0,
  `harga_guru` BIGINT NOT NULL DEFAULT 0,
  `grand_total` BIGINT NOT NULL DEFAULT 0,
  `masa_mulai` DATE NOT NULL,
  `masa_selesai` DATE NOT NULL,
  `sumber_dana` VARCHAR(100) NOT NULL,
  `sumber_dana_lain` VARCHAR(255) NULL,
  `kota` VARCHAR(100) NOT NULL,
  `tanggal_ttd` DATE NULL,
  `jumlah_rombel` INT NOT NULL DEFAULT 0,
  `versi_pricelist` VARCHAR(50) NOT NULL,
  `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `diubah_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  `nama_pm` VARCHAR(255) NULL,
  `nama_sm` VARCHAR(255) NULL,
  `diverifikasi_oleh` VARCHAR(191) NULL,
  `diverifikasi_pada` DATETIME(3) NULL,
  `sekolah_beku` JSON NULL,
  `asal` VARCHAR(50) NOT NULL DEFAULT 'web',
  `berkas_unggahan` TEXT NULL,
  `ditinjau_pada` DATETIME(3) NULL,
  `ditinjau_oleh` VARCHAR(191) NULL,
  `ditinjau_sidik` VARCHAR(100) NULL,
  `versi_iom` VARCHAR(50) NULL,
  `permintaan_tambahan` BOOLEAN NOT NULL DEFAULT FALSE,
  `nilai_sponsorship` BIGINT NOT NULL DEFAULT 0,
  `diverifikasi_otomatis` BOOLEAN NOT NULL DEFAULT FALSE,
  `skema_ttd` SMALLINT NOT NULL DEFAULT 3,
  `nama_rh` VARCHAR(255) NULL,
  `dibaca_ai_pada` DATETIME(3) NULL,
  `ekstraksi_menunggu` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_po_sekolah_id` (`sekolah_id`),
  KEY `idx_po_dibuat_oleh` (`dibuat_oleh`),
  KEY `idx_po_diverifikasi_oleh` (`diverifikasi_oleh`),
  KEY `idx_po_status` (`status`),
  CONSTRAINT `fk_po_sekolah` FOREIGN KEY (`sekolah_id`) REFERENCES `sekolah` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_po_dibuat_oleh` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT `fk_po_diverifikasi_oleh` FOREIGN KEY (`diverifikasi_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_kelompok` (
  `po_id` VARCHAR(36) NOT NULL,
  `nomor` SMALLINT NOT NULL,
  `nama` VARCHAR(100) NOT NULL,
  `harga_siswa` BIGINT NOT NULL,
  PRIMARY KEY (`po_id`, `nomor`),
  CONSTRAINT `fk_po_kelompok_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_komponen` (
  `po_id` VARCHAR(36) NOT NULL,
  `komponen_id` VARCHAR(100) NOT NULL,
  `sesi` INT NOT NULL DEFAULT 1,
  `kelompok` SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`po_id`, `kelompok`, `komponen_id`),
  CONSTRAINT `fk_po_komponen_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_rombel` (
  `po_id` VARCHAR(36) NOT NULL,
  `kelas` INT NOT NULL,
  `rombel` VARCHAR(50) NOT NULL,
  `jumlah_siswa` INT NOT NULL,
  `kelompok` SMALLINT NOT NULL DEFAULT 1,
  PRIMARY KEY (`po_id`, `kelas`, `rombel`),
  CONSTRAINT `fk_po_rombel_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_termin` (
  `po_id` VARCHAR(36) NOT NULL,
  `urutan` INT NOT NULL,
  `tanggal` DATE NOT NULL,
  `nominal` BIGINT NOT NULL,
  PRIMARY KEY (`po_id`, `urutan`),
  CONSTRAINT `fk_po_termin_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_catatan` (
  `po_id` VARCHAR(36) NOT NULL,
  `jenis` VARCHAR(50) NOT NULL,
  `isi` TEXT NOT NULL,
  PRIMARY KEY (`po_id`, `jenis`),
  CONSTRAINT `fk_po_catatan_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_riwayat` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `po_id` VARCHAR(36) NOT NULL,
  `status_lama` VARCHAR(50) NULL,
  `status_baru` VARCHAR(50) NOT NULL,
  `versi` INT NOT NULL,
  `oleh` VARCHAR(191) NOT NULL,
  `pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_po_riwayat_po_id` (`po_id`),
  CONSTRAINT `fk_po_riwayat_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_pengecualian` (
  `po_id` VARCHAR(36) NOT NULL,
  `lantai_disetujui` BIGINT NOT NULL,
  `harga_disetujui` BIGINT NOT NULL,
  `pelanggaran` JSON NOT NULL,
  `alasan` TEXT NOT NULL,
  `disetujui_oleh` VARCHAR(191) NOT NULL,
  `disetujui_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`po_id`),
  CONSTRAINT `fk_po_pengecualian_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. Komentar & Diskusi PO
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `po_komentar_revisi`;
DROP TABLE IF EXISTS `po_komentar_dibaca`;
DROP TABLE IF EXISTS `po_komentar`;

CREATE TABLE `po_komentar` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NOT NULL,
  `isi` TEXT NOT NULL,
  `oleh` VARCHAR(191) NOT NULL,
  `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `versi_po` INT NOT NULL,
  `disunting_pada` DATETIME(3) NULL,
  `dihapus_pada` DATETIME(3) NULL,
  `dihapus_oleh` VARCHAR(191) NULL,
  `nama_penulis` VARCHAR(255) NULL,
  `peran_penulis` JSON NULL,
  `induk_kunci` VARCHAR(100) NULL,
  `kedalaman` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_po_komentar_po_id` (`po_id`),
  CONSTRAINT `fk_po_komentar_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_komentar_revisi` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `komentar_id` VARCHAR(36) NOT NULL,
  `isi` TEXT NOT NULL,
  `digantikan_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  KEY `idx_po_komentar_revisi_komentar_id` (`komentar_id`),
  CONSTRAINT `fk_po_komentar_revisi` FOREIGN KEY (`komentar_id`) REFERENCES `po_komentar` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `po_komentar_dibaca` (
  `po_id` VARCHAR(36) NOT NULL,
  `oleh` VARCHAR(191) NOT NULL,
  `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`po_id`, `oleh`),
  CONSTRAINT `fk_po_komentar_dibaca_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. Tanda Tangan & Verifikasi
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `tanda_tangan`;
DROP TABLE IF EXISTS `verifikasi`;
DROP TABLE IF EXISTS `verifikasi_otomatis`;
DROP TABLE IF EXISTS `surat_verifikasi`;

CREATE TABLE `tanda_tangan` (
  `po_id` VARCHAR(36) NOT NULL,
  `pihak` ENUM('kepala_sekolah', 'partnership_manager', 'regional_head', 'sales_manager') NOT NULL,
  `nama` VARCHAR(255) NOT NULL,
  `berkas` TEXT NOT NULL,
  `dibubuhkan_oleh` VARCHAR(191) NOT NULL,
  `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `asal` VARCHAR(50) NOT NULL DEFAULT 'kanvas',
  `berkas_dihapus_pada` DATETIME(3) NULL,
  PRIMARY KEY (`po_id`, `pihak`),
  KEY `idx_tanda_tangan_dibubuhkan_oleh` (`dibubuhkan_oleh`),
  CONSTRAINT `fk_tanda_tangan_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_tanda_tangan_dibubuhkan_oleh` FOREIGN KEY (`dibubuhkan_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `verifikasi` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NOT NULL,
  `fungsi` ENUM('education', 'tech_ops', 'finance', 'service_account') NOT NULL,
  `hasil` ENUM('setuju', 'setuju_catatan', 'tolak') NOT NULL,
  `catatan` TEXT NULL,
  `item` JSON NOT NULL,
  `oleh` VARCHAR(191) NOT NULL,
  `waktu` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `versi_po` INT NOT NULL,
  `berlaku` BOOLEAN NOT NULL DEFAULT TRUE,
  `digantikan_pada` DATETIME(3) NULL,
  `sebab_basi` TEXT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_verifikasi_po_id` (`po_id`),
  KEY `idx_verifikasi_oleh` (`oleh`),
  CONSTRAINT `fk_verifikasi_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_verifikasi_oleh` FOREIGN KEY (`oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `verifikasi_otomatis` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NOT NULL,
  `versi_po` INT NOT NULL,
  `versi_iom` VARCHAR(50) NOT NULL,
  `lolos` BOOLEAN NOT NULL,
  `paket` VARCHAR(100) NULL,
  `gagal` JSON NOT NULL,
  `hasil` JSON NOT NULL,
  `dicatat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `kelompok` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_verifikasi_otomatis_po_id` (`po_id`),
  CONSTRAINT `fk_verifikasi_otomatis_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `surat_verifikasi` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NOT NULL,
  `ditandatangani_oleh` VARCHAR(191) NULL,
  `nama_penanda` VARCHAR(255) NULL,
  `berkas` TEXT NULL,
  `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `final_pada` DATETIME(3) NULL,
  `berkas_dihapus_pada` DATETIME(3) NULL,
  `otomatis` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`),
  KEY `idx_surat_verifikasi_po_id` (`po_id`),
  KEY `idx_surat_verifikasi_ditandatangani_oleh` (`ditandatangani_oleh`),
  CONSTRAINT `fk_surat_verifikasi_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_surat_verifikasi_pengguna` FOREIGN KEY (`ditandatangani_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. PKS (Perjanjian Kerjasama) & Sponsorship
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `pks_dokumen_sponsorship`;
DROP TABLE IF EXISTS `pks`;

CREATE TABLE `pks` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NOT NULL,
  `tahun` INT NOT NULL,
  `bulan` INT NOT NULL,
  `dibuat_oleh` VARCHAR(191) NOT NULL,
  `dibuat_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `final_pada` DATETIME(3) NULL,
  `berkas_basah` TEXT NULL,
  `diunggah_oleh` VARCHAR(191) NULL,
  `diunggah_pada` DATETIME(3) NULL,
  `ditandatangani_pada` DATE NULL,
  PRIMARY KEY (`id`),
  KEY `idx_pks_po_id` (`po_id`),
  KEY `idx_pks_dibuat_oleh` (`dibuat_oleh`),
  KEY `idx_pks_diunggah_oleh` (`diunggah_oleh`),
  CONSTRAINT `fk_pks_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pks_dibuat_oleh` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE,
  CONSTRAINT `fk_pks_diunggah_oleh` FOREIGN KEY (`diunggah_oleh`) REFERENCES `pengguna` (`email`) ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pks_dokumen_sponsorship` (
  `po_id` VARCHAR(36) NOT NULL,
  `versi_po` INT NOT NULL,
  `form_ditandatangani` BOOLEAN NOT NULL DEFAULT FALSE,
  `rekening_atas_nama_lembaga` BOOLEAN NOT NULL DEFAULT FALSE,
  `meterai_bila_di_atas_5juta` BOOLEAN NOT NULL DEFAULT FALSE,
  `oleh` VARCHAR(191) NOT NULL,
  `pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`po_id`),
  CONSTRAINT `fk_pks_dokumen_sponsorship_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. Ekstraksi AI Scan & Konfigurasi
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `ekstraksi_po`;
DROP TABLE IF EXISTS `pengaturan_ekstraksi`;

CREATE TABLE `ekstraksi_po` (
  `id` VARCHAR(36) NOT NULL,
  `po_id` VARCHAR(36) NULL,
  `diklaim_oleh` VARCHAR(191) NOT NULL,
  `diklaim_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `dicentang_oleh` VARCHAR(191) NOT NULL,
  `dicentang_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `model` VARCHAR(100) NOT NULL,
  `selesai_pada` DATETIME(3) NULL,
  `durasi_ms` INT NULL,
  `token_masuk` INT NULL,
  `token_keluar` INT NULL,
  `berhasil` BOOLEAN NULL,
  `galat` TEXT NULL,
  `hasil` JSON NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ekstraksi_po_po_id` (`po_id`),
  CONSTRAINT `fk_ekstraksi_po_po` FOREIGN KEY (`po_id`) REFERENCES `po` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pengaturan_ekstraksi` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `menyala` BOOLEAN NOT NULL DEFAULT FALSE,
  `penyedia` VARCHAR(100) NULL,
  `paket_akun` VARCHAR(100) NULL,
  `model` VARCHAR(100) NULL,
  `pemeriksaan_data` VARCHAR(100) NULL,
  `risiko_diterima_oleh` VARCHAR(191) NULL,
  `alasan_risiko` TEXT NULL,
  `diubah_oleh` VARCHAR(191) NULL,
  `diubah_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. Master Acuan Harga & Deklarasi
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `deklarasi_kesiapan`;
DROP TABLE IF EXISTS `harga_komponen`;
DROP TABLE IF EXISTS `harga_paket`;
DROP TABLE IF EXISTS `pricelist_aktif`;

CREATE TABLE `deklarasi_kesiapan` (
  `produk` VARCHAR(100) NOT NULL,
  `versi_produk` VARCHAR(50) NOT NULL,
  `butir` JSON NOT NULL,
  `berlaku_sampai` DATE NOT NULL,
  `ditandatangani_oleh` VARCHAR(191) NOT NULL,
  `ditandatangani_pada` DATETIME(3) NOT NULL,
  PRIMARY KEY (`produk`, `versi_produk`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `harga_komponen` (
  `id` VARCHAR(100) NOT NULL,
  `price_list` BIGINT NOT NULL,
  `bottom` BIGINT NOT NULL,
  `grup` VARCHAR(50) NOT NULL,
  `untuk_guru` BOOLEAN NOT NULL DEFAULT FALSE,
  `per_sesi` BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `harga_paket` (
  `nama` VARCHAR(100) NOT NULL,
  `ids` JSON NOT NULL,
  `price_list` BIGINT NOT NULL,
  `bottom` BIGINT NOT NULL,
  PRIMARY KEY (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `pricelist_aktif` (
  `satu_baris` BOOLEAN NOT NULL DEFAULT TRUE,
  `versi` VARCHAR(50) NOT NULL,
  `diperbarui_pada` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`satu_baris`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
