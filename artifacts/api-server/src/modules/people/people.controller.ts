import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { PeopleService } from "./people.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/people")
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get()
  @UseGuards(OrgContextGuard)
  getPeople(@OrgContext() ctx: OrgCtx) {
    return this.peopleService.getPeople(ctx.orgId);
  }

  @Post()
  @UseGuards(OrgContextGuard)
  addPerson(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.peopleService.addPerson(ctx.orgId, body);
  }

  @Patch(":id")
  @UseGuards(OrgContextGuard)
  updatePerson(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.peopleService.updatePerson(ctx.orgId, Number(id), body);
  }

  @Delete(":id")
  @UseGuards(OrgContextGuard)
  deletePerson(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.peopleService.deletePerson(ctx.orgId, Number(id));
  }
}
