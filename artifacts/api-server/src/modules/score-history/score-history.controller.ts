import { Controller, Get, Post, UseGuards } from "@nestjs/common";
import { ScoreHistoryService } from "./score-history.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class ScoreHistoryController {
  constructor(private readonly scoreHistoryService: ScoreHistoryService) {}

  @Get("orgs/:orgId/score-history")
  @UseGuards(OrgContextGuard)
  getHistory(@OrgContext() ctx: OrgCtx) {
    return this.scoreHistoryService.getHistory(ctx.orgId);
  }

  @Post("orgs/:orgId/score-history/snapshot")
  @UseGuards(OrgContextGuard)
  recordSnapshot(@OrgContext() ctx: OrgCtx) {
    return this.scoreHistoryService.recordSnapshot(ctx.orgId);
  }
}
