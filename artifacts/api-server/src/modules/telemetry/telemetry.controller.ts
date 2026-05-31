import { Controller, Post, Get, Body, Param, UseGuards } from "@nestjs/common";
import { TelemetryService } from "./telemetry.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

/**
 * Normalize incoming telemetry body into TelemetryPayload shape.
 * Accepts both the strict payload format {format, source, data} and
 * a convenience format {format, orgId, items, source} where items is
 * an array of control observations with either `ucoControlId` or `controlId`.
 */
function normalizeTelemetryBody(body: Record<string, unknown>) {
  // If caller sent `items` instead of `data`, remap it
  const rawItems = body.items ?? body.data;
  // Normalize items so each has `ucoControlId` (accept `controlId` alias)
  let data: unknown = rawItems;
  if (Array.isArray(rawItems)) {
    data = rawItems.map((item: any) => ({
      ...item,
      ucoControlId: item.ucoControlId ?? item.controlId ?? null,
    }));
  }
  return {
    format: (body.format as string) ?? "json",
    source: (body.source as string) ?? "api-ingest",
    integrationKey: (body.integrationKey as string) ?? "api",
    orgId: body.orgId ? Number(body.orgId) : undefined,
    data,
  };
}

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  /** Org-scoped ingest (requires auth) */
  @Post("orgs/:orgId/telemetry/ingest")
  @UseGuards(OrgContextGuard)
  async ingest(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    const member = ctx.member as Record<string, unknown>;
    const payload = normalizeTelemetryBody(body);
    payload.orgId = ctx.orgId;
    return this.telemetryService.ingest(ctx.orgId, String(member.clerkUserId ?? ""), payload as any);
  }

  /** Public ingest endpoint — authenticated by orgId + API key (or open for telemetry agents) */
  @Post("v1/telemetry/ingest")
  async ingestPublic(@Body() body: Record<string, unknown>) {
    const orgId = Number(body.orgId);
    if (!orgId) return { error: "orgId required", received: 0, mapped: 0, persisted: 0, events: [] };
    const payload = normalizeTelemetryBody(body);
    payload.orgId = orgId;
    return this.telemetryService.ingest(orgId, "api-key", payload as any);
  }

  /** Get telemetry ingest log for an org */
  @Get("orgs/:orgId/telemetry/log")
  @UseGuards(OrgContextGuard)
  async getLog(@OrgContext() ctx: OrgCtx) {
    return this.telemetryService.getIngestLog(ctx.orgId);
  }
}
