import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LifecycleEmailService } from "./lifecycle-email.service";
import { IntegrationSchedulerService } from "./integration-scheduler.service";
import { IntegrationsModule } from "../integrations/integrations.module";

@Module({
  imports: [ScheduleModule.forRoot(), IntegrationsModule],
  providers: [LifecycleEmailService, IntegrationSchedulerService],
})
export class SchedulerModule {}
