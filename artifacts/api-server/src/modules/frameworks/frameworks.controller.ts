import { Controller, Get, Post, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { FrameworksService } from "./frameworks.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class FrameworksController {
  constructor(private readonly frameworksService: FrameworksService) {}

  @Get("frameworks/catalog")
  getCatalog() {
    return this.frameworksService.getCatalog();
  }

  @Get("orgs/:orgId/frameworks")
  @UseGuards(OrgContextGuard)
  getOrgFrameworks(@OrgContext() ctx: OrgCtx) {
    return this.frameworksService.getOrgFrameworks(ctx.orgId);
  }

  @Post("orgs/:orgId/frameworks")
  @UseGuards(OrgContextGuard)
  addFrameworks(@OrgContext() ctx: OrgCtx, @Body() body: { frameworkKeys: string[] }) {
    return this.frameworksService.addFrameworks(ctx.orgId, body.frameworkKeys);
  }

  @Delete("orgs/:orgId/frameworks/:key")
  @UseGuards(OrgContextGuard)
  removeFramework(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.frameworksService.removeFramework(ctx.orgId, key);
  }

  @Get("orgs/:orgId/frameworks/:key/controls")
  @UseGuards(OrgContextGuard)
  getFrameworkControls(@OrgContext() ctx: OrgCtx, @Param("key") key: string) {
    return this.frameworksService.getFrameworkControls(ctx.orgId, key);
  }
}
