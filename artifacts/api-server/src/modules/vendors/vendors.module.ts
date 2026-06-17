import { Module } from "@nestjs/common";
import { VendorsController } from "./vendors.controller";
import { VendorsService } from "./vendors.service";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [NotificationsModule],
  controllers: [VendorsController],
  providers: [VendorsService],
})
export class VendorsModule {}
