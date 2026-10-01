# Handoff — updated 2026-09-26 by Claude Code (Opus 5.5)
<!-- Live state; overwrite, do not append. Protocol: ~/.agents/handoff-protocol.md -->

## Goal
PO scan extraction (spec `catatan/17`, plan `catatan/25`). **LIVE in production 25 Sep 2026 with
the gate OFF** — no AI reading happens until a Super Admin turns the gate on at `/ekstraksi`.

## Done (this stretch)
- 2026-09-26 performance migration `20260927010000_kinerja_rls_indeks` merged to main (6d88f2c), **APPLIED to production
  2026-09-26 by Rizki (`supabase db push`)**: 16 policies `auth.jwt()` → `(select auth.jwt())` via ALTER POLICY, 7 FK indexes,
  identity PK on `po_komentar_revisi`. Proof `uji/db-lokal/jalankan-bukti-kinerja.sh` (K1-K5 all OK),
  independent QA PASS_WITH_NOTES. FOR ALL policies deliberately NOT split (would change SELECT scope).
  Advisor after apply: auth_rls_initplan, unindexed_foreign_keys, no_primary_key gone; remaining =
  unused_index (7 new indexes, too fresh to be used) + multiple_permissive_policies (intentional).
- Model switched `deepseek-v4-flash-vision-exp` → `deepseek-v4.1-flash` before release (`04303a4`).
- Release (Tugas 12): Rizki applied migrations 20260926010000/020000/030000 (`migration list` 72/72
  in sync); production `private.model_ekstraksi()` = `deepseek-v4.1-flash`, 0 gate rows.
  Rizki ran `vercel --prod`. Smoke: `/ekstraksi` 307 → `/masuk` (unknown path 404, so the new route
  is live), `/beranda` and `/po/baru` 307 → `/masuk`.
- `build/ekstraksi-scan-po` merged into `main`.

## In progress
- Not verified by an agent: `OPENCODE_GO_API_KEY` set in Vercel (production + preview) — Rizki to
  confirm. A dummy upload from a real Sales account (gate off = upload path as before).

## Next
0. **Rizki is testing the release with the business team (25 Sep).** Wait for their findings
   before new work. Candidates after that: Supabase org → Pro (free plan pauses after ~1 week idle;
   budget decision), ask team for handwritten dummy POs, build statuses `aktif`/`selesai`.
1. Three conditions before turning the gate ON (`catatan/17` "Sebelum gerbang dinyalakan"):
   OpenCode Go terms checked for production; 5-10 handwritten DUMMY Form POs measured — on the NEW
   model (the 93% spike figure was the old model); notice wording (`catatan/10`) sent to legal.
2. When turning it on, the gate row's `model` field must say `deepseek-v4.1-flash` (starts empty).
3. After that: resume other backlog (see Brain `skolla-kerjasama-sistem.md`).

## Decisions (don't redo)
- Provider: DeepSeek V4.1 Flash via OpenCode Go, no DPA, risk accepted by Rizki. Go uses the dotted
  id `deepseek-v4.1-flash`. Model name pinned in `lib/penyedia-ekstraksi.ts` AND
  `private.model_ekstraksi()`; a test asserts they agree (repo files only, not the live DB).
- Read happens BEFORE the draft exists; per-step confirmation state in `po.ekstraksi_menunggu`
  (`wajib:` prefix for fields needing their own tick).

## Traps
- Agent cannot run `supabase db push` or `vercel --prod`/`vercel` CLI (permission classifier).
  Rizki runs both FROM THE PROJECT DIR.
- Changing the model now needs a NEW migration — 20260926010000 is applied.
- Direct curl to OpenCode Go needs header `x-opencode-session`, else 400 MissingSessionID.
- `npm install` here prunes devDependencies (NODE_ENV=production): use `npm install --include=dev`.
- `public/pdf.worker.min.mjs` is copied BY HAND from `pdfjs-dist`; re-copy on upgrade.
- No real POs in any test file. Migrations go in BOTH `supabase/migrasi/` and `supabase/migrations/`.
- Supabase ref `lzamazdfaidxuohhzpjd` is on the free plan; pauses after ~1 week idle.
