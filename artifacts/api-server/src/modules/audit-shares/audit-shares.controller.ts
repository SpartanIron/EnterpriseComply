import { Controller, Get, Post, Delete, Body, Param, ParseIntPipe, UseGuards, Req } from "@nestjs/common";
import type { Request } from "express";
import { AuditSharesService } from "./audit-shares.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class AuditSharesController {
  constructor(private readonly auditSharesService: AuditSharesService) {}

  // ── Authenticated: manage shares for an org ────────────────────────────────
  @Get("orgs/:orgId/audit-shares")
  @UseGuards(OrgContextGuard)
  list(@OrgContext() ctx: OrgCtx) {
    return this.auditSharesService.list(ctx.orgId);
  }

  @Post("orgs/:orgId/audit-shares")
  @UseGuards(OrgContextGuard)
  create(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.auditSharesService.create(ctx.orgId, userId, body as any);
  }

  @Delete("orgs/:orgId/audit-shares/:id")
  @UseGuards(OrgContextGuard)
  revoke(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.auditSharesService.revoke(ctx.orgId, id, userId);
  }

  // ── Public: auditor reads the package via token (no auth required) ────────
  @Get("audit/:token")
  getAuditPackage(@Param("token") token: string, @Req() req: Request) {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip;
    return this.auditSharesService.getAuditPackage(token, ip);
  }
}
