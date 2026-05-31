import { Module } from "@nestjs/common";
import { TelemetryController } from "./telemetry.controller";
import { TelemetryService } from "./telemetry.service";
import { EMassModule } from "../emass/emass.module";

@Module({
  imports: [EMassModule],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule {}
