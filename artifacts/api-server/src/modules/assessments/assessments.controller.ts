import { Controller, Get, Post, Put, Delete, Param, Body, Param as P, UseGuards, Res } from "@nestjs/common";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { AssessmentsService } from "./assessments.service";
import { ReportGeneratorService } from "./report-generator.service";
import type { Response } from "express";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class AssessmentsController {
  constructor(
    private readonly svc: AssessmentsService,
    private readonly reportSvc: ReportGeneratorService,
  ) {}

  @Get("orgs/:orgId/assessments/templates")
  @UseGuards(OrgContextGuard)
  getTemplates() {
    return this.svc.getTemplates();
  }

  @Get("orgs/:orgId/assessments")
  @UseGuards(OrgContextGuard)
  list(@OrgContext() ctx: OrgCtx) {
    return this.svc.list(ctx.orgId);
  }

  @Get("orgs/:orgId/assessments/:id")
  @UseGuards(OrgContextGuard)
  getById(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.svc.getById(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/assessments")
  @UseGuards(OrgContextGuard)
  create(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.svc.create(ctx.orgId, userId, body);
  }

  @Put("orgs/:orgId/assessments/:id")
  @UseGuards(OrgContextGuard)
  update(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Body() body: any) {
    return this.svc.update(ctx.orgId, Number(id), body);
  }

  @Post("orgs/:orgId/assessments/:id/score")
  @UseGuards(OrgContextGuard)
  score(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.svc.score(ctx.orgId, Number(id));
  }

  // Sprint 4: Generate report + upload to Cloudflare R2, return signed URL
  @Post("orgs/:orgId/assessments/:id/generate-report")
  @UseGuards(OrgContextGuard)
  async generateReport(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.reportSvc.generateAndStore(ctx.orgId, Number(id));
  }

  // Sprint 4: Download report HTML directly (for print-to-PDF or download)
  @Get("orgs/:orgId/assessments/:id/report-html")
  @UseGuards(OrgContextGuard)
  async getReportHtml(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Res() res: Response) {
    const html = await this.reportSvc.generateReportHtml(ctx.orgId, Number(id));
    const assessment = (await this.svc.getById(ctx.orgId, Number(id))).assessment;
    const filename = `${(assessment.clientName || "Assessment").replace(/[^a-z0-9]/gi, "-")}-ZT-Report.html`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Security-Policy", "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline';");
    res.send(html);
  }

  @Delete("orgs/:orgId/assessments/:id")
  @UseGuards(OrgContextGuard)
  delete(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.svc.delete(ctx.orgId, Number(id));
  }
}
