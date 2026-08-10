import { Module } from "@nestjs/common";
import { AdminController } from "./admin.controller";
import { SecurityMonitorService } from "./security-monitor.service";

@Module({
  controllers: [AdminController],
  providers: [SecurityMonitorService],
  exports: [SecurityMonitorService],
})
export class AdminModule {}
