import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { ClientPortalService } from "./client-portal.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

@Controller("orgs/:orgId/portal")
export class ClientPortalController {
  constructor(private readonly portalService: ClientPortalService) {}

  // POST /orgs/:orgId/portal/links
  // Create a new portal link for a completed assessment
  // Body: { assessmentId, clientEmail, clientName, expiresInDays? }
  @Post("links")
  @UseGuards(OrgContextGuard)
  createLink(
    @OrgContext() ctx: OrgCtx,
    @Body() body: {
      assessmentId: number;
      clientEmail: string;
      clientName: string;
      expiresInDays?: number;
    },
  ) {
    if (!body.assessmentId || !body.clientEmail) {
      throw new BadRequestException("assessmentId and clientEmail are required.");
    }
    return this.portalService.createPortalLink(
      ctx.orgId,
      body.assessmentId,
      body.clientEmail,
      body.clientName ?? "Client",
      body.expiresInDays ?? 30,
    );
  }

  // GET /orgs/:orgId/portal/links
  // List all active portal links for the org
  @Get("links")
  @UseGuards(OrgContextGuard)
  listLinks(@OrgContext() ctx: OrgCtx) {
    return { links: this.portalService.listPortalLinks(ctx.orgId) };
  }

  // DELETE /orgs/:orgId/portal/links/:token
  // Revoke a portal link
  @Delete("links/:token")
  @UseGuards(OrgContextGuard)
  revokeLink(@OrgContext() ctx: OrgCtx, @Param("token") token: string) {
    const ok = this.portalService.revokePortalLink(ctx.orgId, token);
    if (!ok) throw new NotFoundException("Portal link not found or not authorized.");
    return { success: true };
  }

  // GET /orgs/:orgId/portal/storage-status
  // Returns R2 configuration status
  @Get("storage-status")
  @UseGuards(OrgContextGuard)
  storageStatus(@OrgContext() ctx: OrgCtx) {
    return this.portalService.getStorageStatus();
  }

  // GET /portal/:token (PUBLIC - no auth required)
  // Returns assessment data for a valid portal token
  // This endpoint is consumed by the client-facing portal page
  @Get("/public/:token")
  async publicPortal(@Param("token") token: string) {
    const result = await this.portalService.getPortalAssessment(token);
    if (!result) throw new NotFoundException("Portal link not found, expired, or revoked.");
    return result;
  }
}
