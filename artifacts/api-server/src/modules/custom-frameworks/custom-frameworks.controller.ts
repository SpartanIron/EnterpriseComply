import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { CustomFrameworksService } from "./custom-frameworks.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class CustomFrameworksController {
  constructor(private readonly customFrameworksService: CustomFrameworksService) {}

  @Get("orgs/:orgId/custom-frameworks")
  @UseGuards(OrgContextGuard)
  getFrameworks(@OrgContext() ctx: OrgCtx) {
    return this.customFrameworksService.getFrameworks(ctx.orgId);
  }

  @Post("orgs/:orgId/custom-frameworks")
  @UseGuards(OrgContextGuard)
  createFramework(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.customFrameworksService.createFramework(ctx.orgId, userId, body);
  }

  @Patch("orgs/:orgId/custom-frameworks/:id")
  @UseGuards(OrgContextGuard)
  updateFramework(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: any) {
    return this.customFrameworksService.updateFramework(ctx.orgId, Number(id), body);
  }

  @Delete("orgs/:orgId/custom-frameworks/:id")
  @UseGuards(OrgContextGuard)
  deleteFramework(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.customFrameworksService.deleteFramework(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/custom-frameworks/:id/controls")
  @UseGuards(OrgContextGuard)
  getControls(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.customFrameworksService.getControls(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/custom-frameworks/:id/controls")
  @UseGuards(OrgContextGuard)
  createControl(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: any) {
    return this.customFrameworksService.createControl(ctx.orgId, Number(id), body);
  }

  @Patch("orgs/:orgId/custom-frameworks/controls/:controlId")
  @UseGuards(OrgContextGuard)
  updateControl(@OrgContext() ctx: OrgCtx, @Param("controlId") controlId: string, @Body() body: any) {
    return this.customFrameworksService.updateControl(ctx.orgId, Number(controlId), body);
  }

  @Delete("orgs/:orgId/custom-frameworks/controls/:controlId")
  @UseGuards(OrgContextGuard)
  deleteControl(@OrgContext() ctx: OrgCtx, @Param("controlId") controlId: string) {
    return this.customFrameworksService.deleteControl(ctx.orgId, Number(controlId));
  }

  @Post("orgs/:orgId/custom-frameworks/:id/controls/import")
  @UseGuards(OrgContextGuard)
  bulkImport(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: { controls: any[] }) {
    return this.customFrameworksService.bulkImportControls(ctx.orgId, Number(id), body.controls);
  }
}
