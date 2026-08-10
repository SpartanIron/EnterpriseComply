import { Module } from "@nestjs/common";
import { PublicStatusController } from "./public-status.controller";
import { SystemHealthService } from "./system-health.service";
import { StatusSubscribersController } from "./status-subscribers.controller";
import { StatusSubscribersService } from "./status-subscribers.service";

@Module({
  controllers: [PublicStatusController, StatusSubscribersController],
  providers:   [SystemHealthService, StatusSubscribersService],
  exports:     [SystemHealthService, StatusSubscribersService],
})
export class PublicStatusModule {}
