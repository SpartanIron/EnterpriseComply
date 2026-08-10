import { Controller, Get, Post, Delete, Body, Param, UseGuards, ParseIntPipe } from "@nestjs/common";
import { EvidenceService } from "./evidence.service";
import { WormLedgerService } from "./worm-ledger.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";
import { RequireRole } from "../../guards/roles.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller("orgs/:orgId/evidence")
@UseGuards(OrgContextGuard)
export class EvidenceController {
  constructor(
    private readonly evidenceService: EvidenceService,
    private readonly wormLedger: WormLedgerService,
  ) {}

  @Get()
  getEvidence(@OrgContext() ctx: OrgCtx) {
    return this.evidenceService.getEvidence(ctx.orgId);
  }

  @Post()
  @UseGuards(RequireRole("analyst"))
  addEvidence(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.evidenceService.addEvidence(ctx.orgId, userId, body as any);
  }


  /**
   * WORM ledger endpoints.
   *
   * Declared before the ":id/..." routes on purpose: Nest matches in
   * declaration order and "ledger" would otherwise be swallowed by ":id".
   */

  /** Cryptographic chain verification for an auditor. */
  @Get("ledger/verify")
  @UseGuards(RequireRole("compliance_manager"))
  verifyLedger(@OrgContext() ctx: OrgCtx) {
    return this.wormLedger.verifyChain(ctx.orgId);
  }

  /** Ledger size / first + last entry, for the trust center and dashboards. */
  @Get("ledger/stats")
  @UseGuards(RequireRole("viewer"))
  ledgerStats(@OrgContext() ctx: OrgCtx) {
    return this.wormLedger.getLedgerStats(ctx.orgId);
  }

  /** Full ledger export in EC-WORM-LEDGER-v1 format for external audit. */
  @Get("ledger/export")
  @UseGuards(RequireRole("compliance_manager"))
  exportLedger(@OrgContext() ctx: OrgCtx) {
    return this.wormLedger.exportLedger(ctx.orgId);
  }

  /**
   * Confirms the database-level WORM triggers are still installed. This is the
   * control that catches an API restart silently dropping immutability.
   */
  @Get("ledger/worm-status")
  @UseGuards(RequireRole("compliance_manager"))
  wormStatus() {
    return this.wormLedger.getWormStatus();
  }

  /** Phase 3A: verify SHA-256 integrity of a stored evidence snapshot */
  @Get(":id/verify")
  verifyIntegrity(
    @OrgContext() ctx: OrgCtx,
    @Param("id", ParseIntPipe) evidenceId: number,
  ) {
    return this.evidenceService.verifyEvidenceIntegrity(ctx.orgId, evidenceId);
  }

  @Delete(":id")
  @UseGuards(RequireRole("compliance_manager"))
  deleteEvidence(
    @OrgContext() ctx: OrgCtx,
    @ClerkUserId() userId: string,
    @Param("id", ParseIntPipe) evidenceId: number,
  ) {
    return this.evidenceService.deleteEvidence(ctx.orgId, evidenceId, userId);
  }
}
