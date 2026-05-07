import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from "@nestjs/common";
import { MonitoringService } from "./monitoring.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get("orgs/:orgId/notifications")
  @UseGuards(OrgContextGuard)
  getNotifications(@OrgContext() ctx: OrgCtx) {
    return this.monitoringService.getNotifications(ctx.orgId);
  }

  @Post("orgs/:orgId/notifications/read")
  @UseGuards(OrgContextGuard)
  markRead(@OrgContext() ctx: OrgCtx, @Body() body: { ids?: number[] }) {
    if (body.ids) return this.monitoringService.markRead(ctx.orgId, body.ids);
    return this.monitoringService.markAllRead(ctx.orgId);
  }

  @Get("orgs/:orgId/monitoring")
  @UseGuards(OrgContextGuard)
  getMonitoringJobs(@OrgContext() ctx: OrgCtx) {
    return this.monitoringService.getMonitoringJobs(ctx.orgId);
  }

  @Post("orgs/:orgId/monitoring/check")
  @UseGuards(OrgContextGuard)
  triggerCheck(@OrgContext() ctx: OrgCtx, @Body() body: { integrationKey: string }) {
    return this.monitoringService.triggerCheck(ctx.orgId, body.integrationKey);
  }

  @Get("orgs/:orgId/monitoring/settings")
  @UseGuards(OrgContextGuard)
  getSettings(@OrgContext() ctx: OrgCtx) {
    return this.monitoringService.getSettings(ctx.orgId);
  }

  @Patch("orgs/:orgId/monitoring/settings")
  @UseGuards(OrgContextGuard)
  updateSettings(@OrgContext() ctx: OrgCtx, @Body() body: any) {
    return this.monitoringService.updateSettings(ctx.orgId, body);
  }

  @Get("orgs/:orgId/audit-log")
  @UseGuards(OrgContextGuard)
  getAuditLog(@OrgContext() ctx: OrgCtx, @Query("limit") limit?: string) {
    return this.monitoringService.getAuditLog(ctx.orgId, limit ? Number(limit) : 100);
  }
}
