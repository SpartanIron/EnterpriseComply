import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { PoamService } from "./poam.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/poam")
export class PoamController {
  constructor(private readonly poamService: PoamService) {}

  @Get()
  @UseGuards(OrgContextGuard)
  getItems(@OrgContext() ctx: OrgCtx) {
    return this.poamService.getItems(ctx.orgId);
  }

  @Post()
  @UseGuards(OrgContextGuard)
  createItem(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.poamService.createItem(ctx.orgId, body);
  }

  @Post("bulk-from-failing")
  @UseGuards(OrgContextGuard)
  createFromFailingControls(@OrgContext() ctx: OrgCtx) {
    return this.poamService.createFromFailingControls(ctx.orgId);
  }

  @Patch(":id")
  @UseGuards(OrgContextGuard)
  updateItem(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.poamService.updateItem(ctx.orgId, Number(id), body);
  }

  @Delete(":id")
  @UseGuards(OrgContextGuard)
  deleteItem(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.poamService.deleteItem(ctx.orgId, Number(id));
  }
}
