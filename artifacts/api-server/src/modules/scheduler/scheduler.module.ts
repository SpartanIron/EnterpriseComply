import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LifecycleEmailService } from "./lifecycle-email.service";
import { IntegrationSchedulerService } from "./integration-scheduler.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [LifecycleEmailService, IntegrationSchedulerService],
})
export class SchedulerModule {}
