import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ScapService } from "./scap.service";
import { OrgContextGuard, OrgContext } from "../../guards/clerk-auth.guard";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

@Controller("orgs/:orgId/scap")
export class ScapController {
  constructor(private readonly scapService: ScapService) {}

  // POST /orgs/:orgId/scap/parse
  // Accepts raw XCCDF XML in the request body and returns parsed findings
  // without persisting.  Useful for preview before committing an import.
  @Post("parse")
  @UseGuards(OrgContextGuard)
  parseXccdf(@OrgContext() ctx: OrgCtx, @Body() body: { xmlContent: string }) {
    if (!body.xmlContent || body.xmlContent.length < 100) {
      throw new BadRequestException("xmlContent is required and must contain valid XCCDF XML.");
    }
    return this.scapService.parseXccdfContent(body.xmlContent);
  }

  // POST /orgs/:orgId/scap/import
  // Accepts raw XCCDF XML in the request body, parses it, creates a new
  // STIG checklist record, and bulk-inserts all findings.
  @Post("import")
  @UseGuards(OrgContextGuard)
  importXccdf(@OrgContext() ctx: OrgCtx, @Body() body: { xmlContent: string }) {
    if (!body.xmlContent || body.xmlContent.length < 100) {
      throw new BadRequestException("xmlContent is required and must contain valid XCCDF XML.");
    }
    return this.scapService.importXccdf(ctx.orgId, body.xmlContent);
  }
}
