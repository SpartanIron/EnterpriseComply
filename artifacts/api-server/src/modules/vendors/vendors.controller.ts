import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { VendorsService } from "./vendors.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/vendors")
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @UseGuards(OrgContextGuard)
  getVendors(@OrgContext() ctx: OrgCtx) {
    return this.vendorsService.getVendors(ctx.orgId);
  }

  @Post()
  @UseGuards(OrgContextGuard)
  addVendor(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.vendorsService.addVendor(ctx.orgId, body);
  }

  @Patch(":id")
  @UseGuards(OrgContextGuard)
  updateVendor(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.vendorsService.updateVendor(ctx.orgId, Number(id), body);
  }

  @Delete(":id")
  @UseGuards(OrgContextGuard)
  deleteVendor(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.vendorsService.deleteVendor(ctx.orgId, Number(id));
  }
}
