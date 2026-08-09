import { Module } from "@nestjs/common";
import { TestRunsController } from "./test-runs.controller";
import { TestRunsService } from "./test-runs.service";
import { SchedulerModule } from "../scheduler/scheduler.module";

@Module({
  imports: [SchedulerModule],
  controllers: [TestRunsController],
  providers: [TestRunsService],
})
export class TestRunsModule {}
