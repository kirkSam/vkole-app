// @ts-check
/**
 * Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
 * (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
 *
 * Applied files are keyed by BASENAME, so the same file applies once no matter
 * which directory it is globbed from. That is what makes the auth schema safe to
 * copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
 * a database that already has `0001_auth.sql` will not re-run it.
 *
 * Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
 * out of scope for both until it is copied up.
 */

/**
 * The `_migrations` key for a migration path (or bare filename).
 * @param {string} path
 * @returns {string}
 */
export function migrationName(path) {
  return path.split("/").pop() ?? path;
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isMigrationFile(path) {
  return path.endsWith(".sql");
}

/**
 * Migrations in `paths` that are not yet in `applied`, in apply order.
 * Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .filter(({ name }) => !done.has(name));
}

/**
 * Preview-only scripts. They delete a test parent or rewrite trial dates.
 * The live migrator (DATABASE_URL) must not apply them.
 * The in-memory preview still applies migrations/*.sql.
 */
export const PREVIEW_ONLY_MIGRATIONS = new Set([
  "0006_mira_math_trial.sql",
  "0007_close_mira_math_trial.sql",
  "0010_demo_trial_elapsed.sql",
  "0011_clear_preview_parent.sql",
  "0012_clear_parent_again.sql",
  "0013_remove_recovery_test.sql",
  "0015_sam_trial_used.sql",
  "0016_reset_vkole_m_trial.sql",
  "0020_trial_finished_for_test.sql",
  "0021_fresh_free_trial.sql",
  "0022_free_week_over.sql",
  "0023_free_week_over_again.sql",
]);

/**
 * Live-database migrations: pending files except the preview-only test scripts.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingLiveMigrations(paths, applied) {
  return pendingMigrations(paths, applied).filter(({ name }) => !PREVIEW_ONLY_MIGRATIONS.has(name));
}
