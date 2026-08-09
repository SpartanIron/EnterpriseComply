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
import { RequireRole } from "../../guards/roles.guard";
import { RequirePlan } from "../../guards/plan.guard";

interface OrgCtx {
  orgId: number;
  org: Record<string, unknown>;
  member: Record<string, unknown>;
}

@Controller("orgs/:orgId/scap")
export class ScapController {
  constructor(private readonly scapService: ScapService) {}

  // POST /orgs/:orgId/scap/parse — requires federal plan (P1-07)
  // SCAP/XCCDF is a DoD standard. Accepts raw XCCDF XML and returns parsed findings
  // without persisting. Useful for preview before committing an import.
  @Post("parse")
  @UseGuards(OrgContextGuard, RequirePlan("federal"), RequireRole("compliance_manager"))
  parseXccdf(@OrgContext() ctx: OrgCtx, @Body() body: { xmlContent: string }) {
    if (!body.xmlContent || body.xmlContent.length < 100) {
      throw new BadRequestException("xmlContent is required and must contain valid XCCDF XML.");
    }
    return this.scapService.parseXccdfContent(body.xmlContent);
  }

  // POST /orgs/:orgId/scap/import — requires federal plan (P1-07)
  // Accepts raw XCCDF XML, parses it, creates a new STIG checklist record,
  // and bulk-inserts all findings.
  @Post("import")
  @UseGuards(OrgContextGuard, RequirePlan("federal"), RequireRole("compliance_manager"))
  importXccdf(@OrgContext() ctx: OrgCtx, @Body() body: { xmlContent: string }) {
    if (!body.xmlContent || body.xmlContent.length < 100) {
      throw new BadRequestException("xmlContent is required and must contain valid XCCDF XML.");
    }
    return this.scapService.importXccdf(ctx.orgId, body.xmlContent);
  }
}
