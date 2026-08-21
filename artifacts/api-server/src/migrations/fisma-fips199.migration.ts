import { sql } from "drizzle-orm";

/**
 * FIPS 199 impact level. Phase 1c.
 *
 * One nullable column on organizations. Idempotent, so it is safe on every
 * boot, and additive, so no expand-contract dance is required: nothing reads
 * the column before this runs and nothing writes it except an explicit request.
 *
 * There is no schema here for FISMA itself, deliberately. FISMA does not
 * publish a control set; agencies implement it through NIST SP 800-53, scoped
 * by the FIPS 199 categorisation of the system. So FISMA is declared in code as
 * a pass-through of the existing 800-53 mappings - see FRAMEWORK_PASS_THROUGHS
 * in lib/framework-mappings.ts - and no mapping rows are created for it. That
 * is the difference between adding a framework and re-authoring one.
 *
 * The reverse of this migration is scripts/rollback-fisma-fips199.cjs, which was
 * committed before this file.
 */
export async function runFismaFips199Migration(db: any): Promise<void> {
  await db.execute(
    sql`ALTER TABLE organizations ADD COLUMN IF NOT EXISTS fips_199_impact TEXT`,
  );
}
