import { Controller, Get, Patch, Param, UseGuards } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; }

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get("orgs/:orgId/notifications")
  @UseGuards(OrgContextGuard)
  getNotifications(@OrgContext() ctx: OrgCtx) {
    return this.notificationsService.getNotifications(ctx.orgId);
  }

  @Patch("orgs/:orgId/notifications/mark-all-read")
  @UseGuards(OrgContextGuard)
  markAllRead(@OrgContext() ctx: OrgCtx) {
    return this.notificationsService.markAllRead(ctx.orgId);
  }

  @Patch("orgs/:orgId/notifications/:id/read")
  @UseGuards(OrgContextGuard)
  markRead(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.notificationsService.markRead(ctx.orgId, Number(id));
  }
}
