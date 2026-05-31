import { Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe } from "@nestjs/common";
import { TelemetryService, TelemetryPayload } from "./telemetry.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { ClerkAuthGuard, ClerkUser } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }
interface UserCtx { userId: string; }

@Controller()
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  // Authenticated org-scoped ingest
  @Post("orgs/:orgId/telemetry/ingest")
  @UseGuards(OrgContextGuard)
  async ingest(@OrgContext() ctx: OrgCtx, @Body() body: TelemetryPayload) {
    const member = ctx.member as Record<string, unknown>;
    return this.telemetryService.ingest(ctx.orgId, String(member.clerkUserId ?? ""), body);
  }

  // Public ingest endpoint (API key auth via X-Api-Key header — key = orgId for now)
  @Post("v1/telemetry/ingest")
  async ingestPublic(@Body() body: TelemetryPayload & { orgId: number }) {
    if (!body.orgId) throw new Error("orgId required");
    return this.telemetryService.ingest(Number(body.orgId), "api-key", body);
  }

  // Get ingest log
  @Get("orgs/:orgId/telemetry/log")
  @UseGuards(OrgContextGuard)
  async getLog(@OrgContext() ctx: OrgCtx) {
    return this.telemetryService.getIngestLog(ctx.orgId);
  }
}
