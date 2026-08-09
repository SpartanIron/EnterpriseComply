import { Module } from "@nestjs/common";
import { PublicStatusController } from "./public-status.controller";
import { SystemHealthService } from "./system-health.service";

@Module({
  controllers: [PublicStatusController],
  providers:   [SystemHealthService],
  exports:     [SystemHealthService],
})
export class PublicStatusModule {}
