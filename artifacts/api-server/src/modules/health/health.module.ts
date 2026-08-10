import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [SchedulerModule],
  controllers: [HealthController],
})
export class HealthModule {}
