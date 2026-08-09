import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { PoamService } from "./poam.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

// All POA&M endpoints require the 'federal' plan (P1-07).
// POA&M is a DoD/FedRAMP-specific artifact required for CMMC Level 2 and FedRAMP.
@Controller("orgs/:orgId/poam")
@UseGuards(OrgContextGuard, RequirePlan("federal"))
export class PoamController {
  constructor(private readonly poamService: PoamService) {}

  @Get()
  getItems(@OrgContext() ctx: OrgCtx) {
    return this.poamService.getItems(ctx.orgId);
  }

  @Post()
  @UseGuards(RequireRole("compliance_manager"))
  createItem(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.poamService.createItem(ctx.orgId, body);
  }

  @Post("bulk-from-failing")
  @UseGuards(RequireRole("compliance_manager"))
  createFromFailingControls(@OrgContext() ctx: OrgCtx) {
    return this.poamService.createFromFailingControls(ctx.orgId);
  }

  @Patch(":id")
  @UseGuards(RequireRole("compliance_manager"))
  updateItem(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.poamService.updateItem(ctx.orgId, Number(id), body);
  }

  @Delete(":id")
  @UseGuards(RequireRole("compliance_manager"))
  deleteItem(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.poamService.deleteItem(ctx.orgId, Number(id));
  }
}
