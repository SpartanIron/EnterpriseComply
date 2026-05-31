import { Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe, Headers } from "@nestjs/common";
import { TelemetryService } from "./telemetry.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post("orgs/:orgId/telemetry/ingest")
  @UseGuards(OrgContextGuard)
  async ingest(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    const member = ctx.member as Record<string, unknown>;
    return this.telemetryService.ingest(ctx.orgId, String(member.clerkUserId ?? ""), body as any);
  }

  @Post("v1/telemetry/ingest")
  async ingestPublic(@Body() body: Record<string, unknown>) {
    const orgId = Number(body.orgId);
    if (!orgId) return { error: "orgId required", received: 0, mapped: 0, persisted: 0, events: [] };
    return this.telemetryService.ingest(orgId, "api-key", body as any);
  }

  @Get("orgs/:orgId/telemetry/log")
  @UseGuards(OrgContextGuard)
  async getLog(@OrgContext() ctx: OrgCtx) {
    return this.telemetryService.getIngestLog(ctx.orgId);
  }
}