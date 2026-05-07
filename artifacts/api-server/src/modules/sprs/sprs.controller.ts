import { Controller, Get, UseGuards } from "@nestjs/common";
import { SprsService } from "./sprs.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class SprsController {
  constructor(private readonly sprsService: SprsService) {}

  @Get("orgs/:orgId/sprs")
  @UseGuards(OrgContextGuard)
  calculate(@OrgContext() ctx: OrgCtx) {
    return this.sprsService.calculate(ctx.orgId);
  }
}
