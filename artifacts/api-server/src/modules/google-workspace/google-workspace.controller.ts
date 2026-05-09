import { Controller, Get, Post, Delete, Body, UseGuards, HttpCode, HttpStatus } from "@nestjs/common";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { GoogleWorkspaceService } from "./google-workspace.service";

interface OrgCtx { orgId: number; org: any; member: any; }

@Controller("orgs/:orgId/integrations/google-workspace")
@UseGuards(OrgContextGuard)
export class GoogleWorkspaceController {
  constructor(private readonly gwService: GoogleWorkspaceService) {}

  @Get("status")
  async getStatus(@OrgContext() ctx: OrgCtx) {
    const row = await this.gwService.getIntegration(ctx.orgId);
    if (!row) return { connected: false, status: "disconnected" };
    return {
      connected: row.status === "active",
      status: row.status,
      domain: (row.metadata as any)?.domain || null,
      adminEmail: row.accountLogin || null,
      lastSyncAt: row.lastSyncAt || null,
      lastSyncStatus: row.lastSyncStatus || null,
      lastSyncError: row.lastSyncError || null,
      evidenceCollected: row.evidenceCollected,
    };
  }

  @Post("connect")
  async connect(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { serviceAccountKeyJson: string; domain: string; adminEmail: string }
  ) {
    return this.gwService.connect(ctx.orgId, body);
  }

  @Delete("disconnect")
  @HttpCode(HttpStatus.OK)
  async disconnect(@OrgContext() ctx: OrgCtx) {
    return this.gwService.disconnect(ctx.orgId);
  }

  @Post("sync")
  async sync(@OrgContext() ctx: OrgCtx) {
    return this.gwService.sync(ctx.orgId);
  }
}
