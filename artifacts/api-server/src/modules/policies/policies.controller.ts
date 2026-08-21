import { Controller, Get, Post, Patch, Delete, Body, Param, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import { policyDocumentDownloadHeaders } from "../../lib/policy-upload.js";
import { PoliciesService } from "./policies.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get("policies/templates")
  getTemplates() {
    return this.policiesService.getTemplates();
  }

  @Get("orgs/:orgId/policies")
  @UseGuards(OrgContextGuard)
  getOrgPolicies(@OrgContext() ctx: OrgCtx) {
    return this.policiesService.getOrgPolicies(ctx.orgId);
  }

  // ── Uploaded policy documents ───────────────────────────────────────────────
  //
  // Declared before the ":id" routes below. Nest matches in declaration order,
  // and "upload-constraints" sits in the same position as ":id", so registering
  // it later would make it unreachable behind a parameter route.

  @Get("orgs/:orgId/policies/upload-constraints")
  @UseGuards(OrgContextGuard)
  getUploadConstraints() {
    return this.policiesService.getUploadConstraints();
  }

  /**
   * Upload a policy document, optionally as a new version of an existing policy.
   *
   * compliance_manager, the same role that may create or edit a policy. Upload
   * is an authoring action, not an administrative one, and requiring owner here
   * would push customers towards sharing the owner account - which is worse for
   * the audit trail than the permission it would be protecting.
   */
  @Post("orgs/:orgId/policies/documents")
  @UseGuards(OrgContextGuard, RequireRole("compliance_manager"))
  uploadPolicyDocument(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.policiesService.uploadPolicyDocument(ctx.orgId, body, {
      userId,
      email: ctx.member?.email as string | undefined,
    });
  }

  @Get("orgs/:orgId/policies/:id/documents")
  @UseGuards(OrgContextGuard)
  listPolicyDocuments(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.listPolicyDocuments(ctx.orgId, Number(id));
  }

  /**
   * The only route that emits document bytes.
   *
   * Headers come from policyDocumentDownloadHeaders rather than being written
   * here: attachment disposition, the Content-Type this platform decided rather
   * than the one the uploader claimed, nosniff, and a sandbox CSP. Keeping them
   * in the library is what stops a second download route from being added later
   * with two of the four.
   */
  @Get("orgs/:orgId/policy-documents/:documentId/download")
  @UseGuards(OrgContextGuard)
  async downloadPolicyDocument(
    @OrgContext() ctx: OrgCtx,
    @Param("documentId") documentId: string,
    @Res() res: Response,
  ) {
    const doc = await this.policiesService.getPolicyDocumentBytes(
      ctx.orgId,
      Number(documentId),
      { email: ctx.member?.email as string | undefined },
    );
    res.set(policyDocumentDownloadHeaders(doc));
    res.send(doc.buffer);
  }

  @Post("orgs/:orgId/policies")
  @UseGuards(OrgContextGuard, RequireRole("compliance_manager"))
  createPolicy(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.policiesService.createPolicy(ctx.orgId, body);
  }

  @Patch("orgs/:orgId/policies/:id")
  @UseGuards(OrgContextGuard, RequireRole("compliance_manager"))
  updatePolicy(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.policiesService.updatePolicy(ctx.orgId, Number(id), body);
  }

  @Delete("orgs/:orgId/policies/:id")
  @UseGuards(OrgContextGuard, RequireRole("admin"))
  deletePolicy(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.deletePolicy(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/policies/:id/acknowledgments")
  @UseGuards(OrgContextGuard)
  getAcknowledgments(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.getAcknowledgments(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/policies/:id/acknowledge")
  @UseGuards(OrgContextGuard)
  acknowledgePolicy(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: { personId: number; ipAddress?: string },
  ) {
    return this.policiesService.acknowledgePolicy(ctx.orgId, Number(id), body);
  }

  @Post("orgs/:orgId/policies/:id/request-acknowledgment")
  @UseGuards(OrgContextGuard, RequireRole("compliance_manager"))
  requestAcknowledgment(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.bulkRequestAcknowledgment(ctx.orgId, Number(id));
  }

  @Get("orgs/:orgId/policies/:id/reviews")
  @UseGuards(OrgContextGuard)
  getPolicyReviews(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.policiesService.getPolicyReviews(ctx.orgId, Number(id));
  }

  @Post("orgs/:orgId/policies/:id/review")
  @UseGuards(OrgContextGuard, RequireRole("compliance_manager"))
  reviewPolicy(
    @OrgContext() ctx: OrgCtx,
    @Param("id") id: string,
    @Body() body: { notes?: string; bumpVersion?: boolean },
  ) {
    return this.policiesService.reviewPolicy(ctx.orgId, Number(id), body);
  }
}
