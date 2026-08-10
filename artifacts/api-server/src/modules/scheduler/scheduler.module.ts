import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LifecycleEmailService } from "./lifecycle-email.service";
import { IntegrationSchedulerService } from "./integration-scheduler.service";
import { ComplianceAlertsService } from "./compliance-alerts.service";
import { RateLimitCleanupService } from "./rate-limit-cleanup.service";
import { IntegrationsModule } from "../integrations/integrations.module";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [ScheduleModule.forRoot(), IntegrationsModule, NotificationsModule],
  providers: [
    LifecycleEmailService,
    IntegrationSchedulerService,
    ComplianceAlertsService,
    RateLimitCleanupService,
  ],
  exports: [IntegrationSchedulerService, RateLimitCleanupService],
})
export class SchedulerModule {}
