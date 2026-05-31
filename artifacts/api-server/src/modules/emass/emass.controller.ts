import { Controller, Post, Get, Body, Param, UseGuards, ParseIntPipe, Headers } from "@nestjs/common";
import { EMassService } from "./emass.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }
@Controller()
export class EMassController {
  constructor(private readonly emassService: EMassService) {}
  @Post("orgs/:orgId/emass/queue-failing")
  @UseGuards(OrgContextGuard)
  queueFailing(@OrgContext() ctx: OrgCtx) { return this.emassService.queueAllFailingControls(ctx.orgId); }
  @Post("orgs/:orgId/emass/queue")
  @UseGuards(OrgContextGuard)
  queueUpdate(@OrgContext() ctx: OrgCtx, @Body() body: { ucoControlId: string; status: string; result: string }) {
    return this.emassService.queueUpdate(ctx.orgId, body.ucoControlId, body.status, body.result);
  }
  @Get("orgs/:orgId/emass/pending")
  @UseGuards(OrgContextGuard)
  listPending(@OrgContext() ctx: OrgCtx) { return this.emassService.listPending(ctx.orgId); }
  @Get("orgs/:orgId/emass/status")
  @UseGuards(OrgContextGuard)
  queueStatus(@OrgContext() ctx: OrgCtx) { return this.emassService.getQueueStatus(ctx.orgId); }
  @Get("orgs/:orgId/emass/poam-export")
  @UseGuards(OrgContextGuard)
  exportPoam(@OrgContext() ctx: OrgCtx) { return this.emassService.exportPoamForeMass(ctx.orgId); }
  @Get("v1/emass/agent/pull/:orgId")
  pullForAgent(@Param("orgId", ParseIntPipe) orgId: number, @Headers("x-agent-id") agentId: string, @Headers("x-user-edipi") edipi: string) {
    return this.emassService.pullForAgent(orgId, agentId ?? "unknown", edipi);
  }
  @Post("v1/emass/agent/acknowledge/:orgId")
  acknowledge(@Param("orgId", ParseIntPipe) orgId: number, @Body() body: { updateIds: string[] }) {
    return this.emassService.acknowledge(orgId, body.updateIds ?? []);
  }
}