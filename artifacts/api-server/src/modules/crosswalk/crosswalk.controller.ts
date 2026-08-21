import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ClerkAuthGuard, OrgContextGuard, ClerkUserId } from "../../guards/clerk-auth.guard";
import { db, controlCrosswalkTable } from "@workspace/db";
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
 * Returns all rows for authenticated org members (falls back to [] if empty).
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
   * Auth-guarded (any org member). Returns DB crosswalk rows; empty array if none.
   */
  @Get("crosswalk/controls")
  @UseGuards(OrgContextGuard)
  async listCrosswalkControls() {
    const rows = await db.select().from(controlCrosswalkTable);
    // Return array directly — consistent with REST convention for list endpoints.
    return rows;
  }
}
