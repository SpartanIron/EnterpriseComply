import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, OrgContextGuard, ClerkUserId, OrgContext } from "../../guards/clerk-auth.guard";
import { db, controlCrosswalkTable, ucoControlsTable, orgControlResultsTable } from "@workspace/db";
import { getResolvedMappings } from "../../lib/framework-mappings";
import { normaliseStatus } from "../../lib/posture";
import { eq } from "drizzle-orm";
import { assertPlatformAccess } from "../../lib/platform-admin";

/**
 * GET /api/admin/crosswalk
 * Returns all control_crosswalk rows. Platform administrators only, and only while elevated.
 *
 * PUT /api/admin/crosswalk/:ucoControlId
 * Updates a single row. Platform administrators only, and only while elevated.
 *
 * GET /api/crosswalk/controls
 * Derived from uco_framework_mappings for authenticated org members. Any row an
 * administrator wrote into control_crosswalk overrides the derived value for the
 * fields it populates.
 */
@Controller()
export class CrosswalkController {
  /**
   * GET /api/admin/crosswalk
   * Platform administrators: list all crosswalk mappings from DB.
   */
  @Get("admin/crosswalk")
  @UseGuards(ClerkAuthGuard)
  async listCrosswalkAdmin(@ClerkUserId() userId: string) {
    await assertPlatformAccess(userId, "crosswalk.read");
    const rows = await db.select().from(controlCrosswalkTable);
    return { crosswalk: rows };
  }

  /**
   * PUT /api/admin/crosswalk/:ucoControlId
   * Platform administrators: upsert a single crosswalk row.
   */
  @Put("admin/crosswalk/:ucoControlId")
  @UseGuards(ClerkAuthGuard)
  async updateCrosswalk(
    @ClerkUserId() userId: string,
    @Param("ucoControlId") ucoControlId: string,
    @Body() body: {
      title?: string;
      domain?: string;
      nist80053?: string;
      cmmc?: string;
      nist800171?: string;
      soc2?: string;
      iso27001?: string;
      fedramp?: string;
      hipaa?: string;
      remediationSteps?: string;
    },
  ) {
    await assertPlatformAccess(userId, "crosswalk.write");
    if (!ucoControlId) {
      throw new BadRequestException("ucoControlId is required");
    }

    // Check if row exists
    const existing = await db
      .select()
      .from(controlCrosswalkTable)
      .where(eq(controlCrosswalkTable.ucoControlId, ucoControlId))
      .limit(1);

    const now = new Date();

    if (existing.length > 0) {
      // Update
      await db
        .update(controlCrosswalkTable)
        .set({
          ...(body.title !== undefined && { title: body.title }),
          ...(body.domain !== undefined && { domain: body.domain }),
          ...(body.nist80053 !== undefined && { nist80053: body.nist80053 }),
          ...(body.cmmc !== undefined && { cmmc: body.cmmc }),
          ...(body.nist800171 !== undefined && { nist800171: body.nist800171 }),
          ...(body.soc2 !== undefined && { soc2: body.soc2 }),
          ...(body.iso27001 !== undefined && { iso27001: body.iso27001 }),
          ...(body.fedramp !== undefined && { fedramp: body.fedramp }),
          ...(body.hipaa !== undefined && { hipaa: body.hipaa }),
          ...(body.remediationSteps !== undefined && { remediationSteps: body.remediationSteps }),
          updatedAt: now,
        })
        .where(eq(controlCrosswalkTable.ucoControlId, ucoControlId));
    } else {
      // Insert — title is required for new rows
      if (!body.title) {
        throw new BadRequestException("title is required when creating a new crosswalk entry");
      }
      await db.insert(controlCrosswalkTable).values({
        ucoControlId,
        title: body.title,
        domain: body.domain ?? null,
        nist80053: body.nist80053 ?? null,
        cmmc: body.cmmc ?? null,
        nist800171: body.nist800171 ?? null,
        soc2: body.soc2 ?? null,
        iso27001: body.iso27001 ?? null,
        fedramp: body.fedramp ?? null,
        hipaa: body.hipaa ?? null,
        remediationSteps: body.remediationSteps ?? null,
        updatedAt: now,
      });
    }

    const [row] = await db
      .select()
      .from(controlCrosswalkTable)
      .where(eq(controlCrosswalkTable.ucoControlId, ucoControlId))
      .limit(1);

    return { ok: true, crosswalk: row };
  }

  /**
   * GET /api/crosswalk/controls
   *
   * Phase 1b. This used to select straight out of control_crosswalk, which has
   * never had a row in it, so the endpoint returned [] every time it was called
   * and the Crosswalk page had nothing to render. That empty table was the third
   * of the three competing answers to "which requirements does this objective
   * satisfy": not a wrong answer, an absent one.
   *
   * It is now derived from uco_framework_mappings, the same table the posture
   * SSOT and the SPRS scorer read. Derived, not copied: there is no write path
   * here and nothing to fall out of step, which is the only way a crosswalk view
   * stays true without somebody remembering to reconcile it.
   *
   * The response keeps the shape the frontend already expects - one row per
   * objective with a column per framework - so this is a data fix rather than a
   * contract change. Where an objective maps to several requirements in one
   * framework they are joined with ", " in the order the identifiers sort,
   * because a stable string is diffable and an arbitrary one is not.
   *
   * Rows still present in control_crosswalk, if an administrator ever wrote any
   * through the admin route below, take precedence for the fields they populate.
   * That keeps a manual override meaningful without letting an empty table erase
   * a derived answer.
   */
  @Get("crosswalk/controls")
  @UseGuards(OrgContextGuard)
  async listCrosswalkControls(@OrgContext() ctx: { orgId: number }) {
    const DERIVED_FRAMEWORKS: Array<{ column: string; frameworkKey: string }> = [
      { column: "nist80053", frameworkKey: "nist-800-53" },
      { column: "cmmc", frameworkKey: "cmmc-l2" },
      { column: "nist800171", frameworkKey: "nist-800-171" },
      { column: "soc2", frameworkKey: "soc2" },
      { column: "iso27001", frameworkKey: "iso27001" },
      { column: "fedramp", frameworkKey: "fedramp" },
      { column: "hipaa", frameworkKey: "hipaa" },
    ];

    const [ucoControls, overrides, results, ...mappingSets] = await Promise.all([
      db.select().from(ucoControlsTable),
      db.select().from(controlCrosswalkTable),
      db.query.orgControlResultsTable.findMany({
        where: eq(orgControlResultsTable.orgId, ctx.orgId),
      }),
      ...DERIVED_FRAMEWORKS.map((f) => getResolvedMappings(f.frameworkKey)),
    ]);

    // objective -> column -> sorted requirement identifiers
    const byObjective = new Map<string, Record<string, string[]>>();

    DERIVED_FRAMEWORKS.forEach((framework, index) => {
      for (const mapping of mappingSets[index] ?? []) {
        let columns = byObjective.get(mapping.ucoControlId);
        if (!columns) {
          columns = {};
          byObjective.set(mapping.ucoControlId, columns);
        }
        const bucket = columns[framework.column] ?? (columns[framework.column] = []);
        if (!bucket.includes(mapping.frameworkControlId)) {
          bucket.push(mapping.frameworkControlId);
        }
      }
    });

    // Phase 1b. A crosswalk row without an assessment status is a reference
    // table, not a compliance view: the reader still has to go somewhere else to
    // learn whether the objective is actually met. Statuses come through the same
    // normaliser the posture SSOT uses, then map onto this endpoint's published
    // vocabulary - a warning is a partial, an objective with no result row is
    // unknown rather than silently passing.
    const statusByObjective = new Map<string, string>();
    for (const result of results as Array<{ ucoControlId: string; status?: unknown }>) {
      const normalised = normaliseStatus(result.status).status;
      statusByObjective.set(
        result.ucoControlId,
        normalised === "warning"
          ? "partial"
          : normalised === "not_tested"
            ? "unknown"
            : normalised,
      );
    }

    const overrideByObjective = new Map(
      overrides.map((row: Record<string, unknown>) => [String(row.ucoControlId), row]),
    );

    return ucoControls
      .map((control: Record<string, unknown>) => {
        const controlId = String(control.controlId);
        const columns = byObjective.get(controlId) ?? {};
        const override = overrideByObjective.get(controlId) as
          | Record<string, unknown>
          | undefined;

        const derived: Record<string, string | null> = {};
        for (const framework of DERIVED_FRAMEWORKS) {
          const identifiers = columns[framework.column];
          derived[framework.column] = identifiers?.length
            ? [...identifiers].sort().join(", ")
            : null;
        }

        return {
          ucoControlId: controlId,
          status: statusByObjective.get(controlId) ?? "unknown",
          title: (override?.title as string) ?? String(control.name),
          domain: (override?.domain as string) ?? String(control.domain),
          nist80053: (override?.nist80053 as string) ?? derived.nist80053,
          cmmc: (override?.cmmc as string) ?? derived.cmmc,
          nist800171: (override?.nist800171 as string) ?? derived.nist800171,
          soc2: (override?.soc2 as string) ?? derived.soc2,
          iso27001: (override?.iso27001 as string) ?? derived.iso27001,
          fedramp: (override?.fedramp as string) ?? derived.fedramp,
          hipaa: (override?.hipaa as string) ?? derived.hipaa,
          remediationSteps:
            (override?.remediationSteps as string) ??
            (control.remediationGuidance as string | null) ??
            null,
          mappedFrameworkCount: Object.values(derived).filter(Boolean).length,
          source: override ? "override" : "derived",
        };
      })
      .sort((a, b) => a.ucoControlId.localeCompare(b.ucoControlId));
  }
}
