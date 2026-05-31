import { Controller, Post, Get, Body, Param, UseGuards, Headers, ParseIntPipe } from "@nestjs/common";
import { EMassService } from "./emass.service";
import { OrgContextGuard, OrgContext, ClerkAuthGuard, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class EMassController {
  constructor(private readonly emassService: EMassService) {}

  // ──────────────────────────────────────────────
  // Org-scoped management endpoints (requires auth)
  // ──────────────────────────────────────────────

  /** Manually queue failing controls for eMASS delivery */
  @Post("orgs/:orgId/emass/queue-failing")
  @UseGuards(OrgContextGuard)
  queueFailing(
    @OrgContext() ctx: OrgCtx,
    @Body() body: { ucoControlIds: string[] },
  ) {
    return this.emassService.queueFailingControls(ctx.orgId, body.ucoControlIds ?? []);
  }

  /** Queue a single manual eMASS update */
  @Post("orgs/:orgId/emass/queue")
  @UseGuards(OrgContextGuard)
  queueUpdate(@OrgContext() ctx: OrgCtx, @Body() body: Record<string, unknown>) {
    return this.emassService.queueUpdate(ctx.orgId, body as any);
  }

  /** Get all pending eMASS updates for this org */
  @Get("orgs/:orgId/emass/pending")
  @UseGuards(OrgContextGuard)
  getPending(@OrgContext() ctx: OrgCtx) {
    return this.emassService.getPendingUpdates(ctx.orgId);
  }

  /** Get eMASS bridge status — queue type, agent protocol info */
  @Get("orgs/:orgId/emass/status")
  @UseGuards(OrgContextGuard)
  getStatus(@OrgContext() ctx: OrgCtx) {
    return this.emassService.getStatus(ctx.orgId);
  }

  /** Export POA&M in eMASS-compatible format */
  @Get("orgs/:orgId/emass/poam-export")
  @UseGuards(OrgContextGuard)
  exportPoam(@OrgContext() ctx: OrgCtx) {
    return this.emassService.exportPoamForeMass(ctx.orgId);
  }

  // ──────────────────────────────────────────────
  // Enclave Agent endpoints (outbound TLS pull)
  // Phase 3B: The enclave agent calls these from inside the DoD boundary.
  // DoD PKI mTLS is terminated at the load-balancer/WAF layer before these routes.
  // EDIPI is passed in X-Agent-EDIPI header by the agent binary.
  // ──────────────────────────────────────────────

  /**
   * Agent pull endpoint — returns all pending eMASS updates for the org.
   * The agent reaches out over outbound TLS from inside the secure enclave.
   */
  @Get("v1/emass/agent/pull/:orgId")
  pullForAgent(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Headers("x-agent-edipi") edipi?: string,
  ) {
    return this.emassService.pullForAgent(orgId, edipi);
  }

  /**
   * Agent acknowledgment — agent calls this after successfully delivering
   * updates to the local eMASS API via DoD PKI mTLS inside the enclave.
   */
  @Post("v1/emass/agent/acknowledge/:orgId")
  acknowledge(
    @Param("orgId", ParseIntPipe) orgId: number,
    @Body() body: { updateIds: string[] },
    @Headers("x-agent-edipi") edipi?: string,
  ) {
    return this.emassService.acknowledge(orgId, body.updateIds ?? [], edipi);
  }
}
