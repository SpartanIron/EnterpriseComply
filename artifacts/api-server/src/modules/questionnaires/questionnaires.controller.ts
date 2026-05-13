import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from "@nestjs/common";
import { QuestionnairesService } from "./questionnaires.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class QuestionnairesController {
  constructor(private readonly questionnairesService: QuestionnairesService) {}

  @Get("orgs/:orgId/questionnaires")
  @UseGuards(OrgContextGuard)
  getQuestionnaires(@OrgContext() ctx: OrgCtx) {
    return this.questionnairesService.getQuestionnaires(ctx.orgId);
  }

  @Post("orgs/:orgId/questionnaires")
  @UseGuards(OrgContextGuard)
  createQuestionnaire(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.questionnairesService.createQuestionnaire(ctx.orgId, userId, body);
  }

  @Get("orgs/:orgId/questionnaires/needs-review")
  @UseGuards(OrgContextGuard)
  getNeedsReview(@OrgContext() ctx: OrgCtx) {
    return this.questionnairesService.getNeedsReviewItems(ctx.orgId);
  }

  @Get("orgs/:orgId/questionnaires/:id/items")
  @UseGuards(OrgContextGuard)
  getItems(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.questionnairesService.getItems(ctx.orgId, Number(id));
  }

  @Patch("orgs/:orgId/questionnaires/items/:itemId")
  @UseGuards(OrgContextGuard)
  updateItem(@OrgContext() ctx: OrgCtx, @Param("itemId") itemId: string, @Body() body: { answer: string }) {
    return this.questionnairesService.updateItem(ctx.orgId, Number(itemId), body);
  }

  @Patch("orgs/:orgId/questionnaires/items/:itemId/approve")
  @UseGuards(OrgContextGuard)
  approveItem(@OrgContext() ctx: OrgCtx, @Param("itemId") itemId: string, @Body() body: { answer?: string }) {
    return this.questionnairesService.approveItem(ctx.orgId, Number(itemId), body.answer);
  }

  @Get("orgs/:orgId/vendor-assessments")
  @UseGuards(OrgContextGuard)
  getVendorAssessments(@OrgContext() ctx: OrgCtx) {
    return this.questionnairesService.getVendorAssessments(ctx.orgId);
  }

  @Delete("orgs/:orgId/questionnaires/:id")
  @UseGuards(OrgContextGuard)
  deleteQuestionnaire(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.questionnairesService.deleteQuestionnaire(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/vendor-assessments")
  @UseGuards(OrgContextGuard)
  sendVendorAssessment(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.questionnairesService.sendVendorAssessment(ctx.orgId, userId, body);
  }
}
