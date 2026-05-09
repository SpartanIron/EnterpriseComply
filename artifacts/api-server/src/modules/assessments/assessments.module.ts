import { Module } from "@nestjs/common";
import { AssessmentsController } from "./assessments.controller";
import { AssessmentsService } from "./assessments.service";
import { ReportGeneratorService } from "./report-generator.service";

@Module({
  controllers: [AssessmentsController],
  providers: [AssessmentsService, ReportGeneratorService],
  exports: [AssessmentsService, ReportGeneratorService],
})
export class AssessmentsModule {}
