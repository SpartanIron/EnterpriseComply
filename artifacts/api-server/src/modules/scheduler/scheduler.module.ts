import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { LifecycleEmailService } from "./lifecycle-email.service";

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [LifecycleEmailService],
})
export class SchedulerModule {}
