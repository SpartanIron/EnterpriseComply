import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db, orgCustomFrameworksTable, orgCustomControlsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class CustomFrameworksService {
  async getFrameworks(orgId: number) {
    const frameworks = await db.query.orgCustomFrameworksTable.findMany({
      where: eq(orgCustomFrameworksTable.orgId, orgId),
    });
    return { frameworks };
  }

  async createFramework(orgId: number, clerkUserId: string, body: {
    name: string; shortName: string; description?: string; category?: string;
  }) {
    const key = `custom-${body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Date.now().toString(36)}`;
    const [framework] = await db.insert(orgCustomFrameworksTable).values({
      orgId,
      key,
      name: body.name,
      shortName: body.shortName,
      description: body.description,
      category: body.category ?? "custom",
      createdBy: clerkUserId,
    }).returning();
    return { framework };
  }

  async updateFramework(orgId: number, frameworkId: number, body: Partial<{
    name: string; shortName: string; description: string; active: boolean;
  }>) {
    const [framework] = await db.update(orgCustomFrameworksTable)
      .set(body)
      .where(and(
        eq(orgCustomFrameworksTable.orgId, orgId),
        eq(orgCustomFrameworksTable.id, frameworkId),
      ))
      .returning();
    return { framework };
  }

  async deleteFramework(orgId: number, frameworkId: number) {
    await db.delete(orgCustomControlsTable)
      .where(and(
        eq(orgCustomControlsTable.orgId, orgId),
        eq(orgCustomControlsTable.frameworkId, frameworkId),
      ));
    await db.delete(orgCustomFrameworksTable)
      .where(and(
        eq(orgCustomFrameworksTable.orgId, orgId),
        eq(orgCustomFrameworksTable.id, frameworkId),
      ));
    return { success: true };
  }

  async getControls(orgId: number, frameworkId: number) {
    const controls = await db.query.orgCustomControlsTable.findMany({
      where: and(
        eq(orgCustomControlsTable.orgId, orgId),
        eq(orgCustomControlsTable.frameworkId, frameworkId),
      ),
      orderBy: (t, { asc }) => [asc(t.domain), asc(t.controlId)],
    });
    return { controls };
  }

  async createControl(orgId: number, frameworkId: number, body: {
    controlId: string; title: string; description?: string;
    domain?: string; guidance?: string; ownerName?: string;
    mappedUcoControlId?: string;
  }) {
    const [control] = await db.insert(orgCustomControlsTable).values({
      orgId,
      frameworkId,
      controlId: body.controlId,
      title: body.title,
      description: body.description,
      domain: body.domain ?? "General",
      guidance: body.guidance,
      ownerName: body.ownerName,
      mappedUcoControlId: body.mappedUcoControlId,
    }).returning();

    const allControls = await db.query.orgCustomControlsTable.findMany({
      where: and(eq(orgCustomControlsTable.orgId, orgId), eq(orgCustomControlsTable.frameworkId, frameworkId)),
    });
    await db.update(orgCustomFrameworksTable)
      .set({ totalControls: allControls.length })
      .where(eq(orgCustomFrameworksTable.id, frameworkId));

    return { control };
  }

  async updateControl(orgId: number, controlId: number, body: Partial<{
    title: string; description: string; domain: string; status: string;
    ownerName: string; notes: string; guidance: string;
  }>) {
    const updates = { ...body } as Record<string, unknown>;
    if (body.status) updates.lastTestedAt = new Date();

    const [control] = await db.update(orgCustomControlsTable)
      .set(updates as Parameters<typeof db.update>[0] extends unknown ? never : never)
      .where(and(
        eq(orgCustomControlsTable.orgId, orgId),
        eq(orgCustomControlsTable.id, controlId),
      ))
      .returning();
    return { control };
  }

  async deleteControl(orgId: number, controlId: number) {
    await db.delete(orgCustomControlsTable)
      .where(and(eq(orgCustomControlsTable.orgId, orgId), eq(orgCustomControlsTable.id, controlId)));
    return { success: true };
  }

  async bulkImportControls(orgId: number, frameworkId: number, controls: Array<{
    controlId: string; title: string; description?: string; domain?: string; guidance?: string;
  }>) {
    if (controls.length === 0) return { imported: 0 };
    const values = controls.map((c) => ({
      orgId,
      frameworkId,
      controlId: c.controlId,
      title: c.title,
      description: c.description,
      domain: c.domain ?? "General",
      guidance: c.guidance,
    }));
    await db.insert(orgCustomControlsTable).values(values);
    await db.update(orgCustomFrameworksTable)
      .set({ totalControls: values.length })
      .where(eq(orgCustomFrameworksTable.id, frameworkId));
    return { imported: values.length };
  }
}
