import { Module } from "@nestjs/common";
import { TestRunsController } from "./test-runs.controller";
import { TestRunsService } from "./test-runs.service";

@Module({ controllers: [TestRunsController], providers: [TestRunsService] })
export class TestRunsModule {}
