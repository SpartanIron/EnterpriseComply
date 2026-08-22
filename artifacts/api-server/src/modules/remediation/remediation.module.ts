import { Logger, Module, OnModuleInit } from "@nestjs/common";
import { db } from "@workspace/db";
import { RemediationController } from "./remediation.controller";
import { RemediationService } from "./remediation.service";
import { runRemediationTasksMigration } from "../../migrations/remediation-tasks.migration";

@Module({
  controllers: [RemediationController],
  providers: [RemediationService],
  exports: [RemediationService],
})
export class RemediationModule implements OnModuleInit {
  private readonly logger = new Logger(RemediationModule.name);

  /**
   * The module that owns the table is the module that ensures it exists.
   *
   * Two reasons this lives here rather than in StartupService with the other
   * boot migrations. Ordering: NestJS runs onModuleInit during module
   * initialisation, which is before the tenant RLS discovery pass in the
   * bootstrap hook, so the table is created in time to have the
   * tenant_isolation policy installed on the same boot instead of sitting
   * outside row level security until the next restart. Locality:
   * StartupService is already long, and a reader asking why
   * org_remediation_tasks exists should find the answer beside the code that
   * queries it.
   *
   * A failure here is logged loudly but does not stop boot. Nothing else in
   * the platform depends on this table, and taking the whole API down over one
   * module schema is a worse outcome than one module returning an error that
   * the health surface already reports.
   */
  async onModuleInit(): Promise<void> {
    try {
      await runRemediationTasksMigration(db);
    } catch (err) {
      this.logger.error(
        "org_remediation_tasks migration failed; GET /orgs/:orgId/remediation will keep failing until this is resolved",
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
