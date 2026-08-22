import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { db } from "@workspace/db";
import { AuditSharesController } from "./audit-shares.controller";
import { AuditSharesService } from "./audit-shares.service";
import { runAuditSharesMigration } from "../../migrations/audit-shares.migration";

@Module({
  controllers: [AuditSharesController],
  providers: [AuditSharesService],
  exports: [AuditSharesService],
})
export class AuditSharesModule implements OnModuleInit {
  private readonly logger = new Logger(AuditSharesModule.name);

  /**
   * The module that owns the table ensures the table exists.
   *
   * Two reasons this lives here rather than in StartupService with the other
   * migrations:
   *
   *   1. Ordering. NestJS runs onModuleInit during module initialisation,
   *      which is before StartupService.onApplicationBootstrap(). The tenant
   *      RLS discovery pass lives in that bootstrap hook and installs the
   *      tenant_isolation policy on every public table carrying an integer
   *      org_id. Creating org_audit_shares first means it is inside row-level
   *      security on the same boot, instead of sitting outside RLS until the
   *      next restart.
   *
   *   2. Locality. StartupService is 2,200 lines and already owns 67 CREATE
   *      TABLE statements. Adding a 68th there makes the ownership of this
   *      table less obvious, not more.
   *
   * A failure here must not stop the process from booting, because nothing
   * else in the platform depends on auditor share links. It must, however, be
   * loud: the symptom of a silent failure is an HTTP 500 that reads like a bug
   * in the share feature rather than a table that was never created.
   */
  async onModuleInit(): Promise<void> {
    try {
      await runAuditSharesMigration(db);
      this.logger.log("org_audit_shares schema ensured");
    } catch (err) {
      this.logger.error(
        "org_audit_shares migration failed - auditor share links will answer 500 until this is resolved: " +
          (err instanceof Error ? err.message : String(err)),
      );
    }
  }
}
