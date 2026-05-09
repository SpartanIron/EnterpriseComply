import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, UseGuards } from "@nestjs/common";
import { Auth, CurrentUser } from "../../guards/auth.guard";
import { AssessmentsService, ASSESSMENT_TEMPLATES } from "./assessments.service";

@Controller("orgs/:orgId/assessments")
@Auth()
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  @Get("templates")
  getTemplates() {
    return this.svc.getTemplates();
  }

  @Get()
  list(@Param("orgId", ParseIntPipe) orgId: number) {
    return this.svc.list(orgId);
  }

  @Get(":id")
  getById(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.svc.getById(orgId, id);
  }

  @Post()
  create(
    @Param("orgId", ParseIntPipe) orgId: number,
    @CurrentUser() user: { clerkUserId: string },
    @Body() body: {
      clientName: string;
      clientEmail?: string;
      clientCompany?: string;
      clientIndustry?: string;
      clientSize?: string;
      frameworkTarget: string;
      deliveryModel?: string;
      consultantName?: string;
      consultantEmail?: string;
      dueDate?: string;
      notes?: string;
    },
  ) {
    return this.svc.create(orgId, user.clerkUserId, body);
  }

  @Put(":id")
  update(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: any,
  ) {
    return this.svc.update(orgId, id, body);
  }

  @Post(":id/score")
  score(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.svc.score(orgId, id);
  }

  @Delete(":id")
  delete(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.svc.delete(orgId, id);
  }
}
