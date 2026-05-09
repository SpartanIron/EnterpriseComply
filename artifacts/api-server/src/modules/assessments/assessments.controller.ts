import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe, Res } from "@nestjs/common";
import { Auth, CurrentUser } from "../../guards/auth.guard";
import { AssessmentsService } from "./assessments.service";
import { ReportGeneratorService } from "./report-generator.service";
import type { Response } from "express";

@Controller("orgs/:orgId/assessments")
@Auth()
export class AssessmentsController {
  constructor(
    private readonly svc: AssessmentsService,
    private readonly reportSvc: ReportGeneratorService,
  ) {}

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

  // Sprint 4: Generate report + upload to Cloudflare R2, return signed URL
  @Post(":id/generate-report")
  async generateReport(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.reportSvc.generateAndStore(orgId, id);
  }

  // Sprint 4: Download report HTML directly (for print-to-PDF or download)
  @Get(":id/report-html")
  async getReportHtml(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
    @Res() res: Response,
  ) {
    const html = await this.reportSvc.generateReportHtml(orgId, id);
    const assessment = (await this.svc.getById(orgId, id)).assessment;
    const filename = `${(assessment.clientName || "Assessment").replace(/[^a-z0-9]/gi, "-")}-ZT-Assessment-Report.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';");
    res.send(html);
  }

  @Delete(":id")
  delete(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.svc.delete(orgId, id);
  }
}
