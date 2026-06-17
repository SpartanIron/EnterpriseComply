import { Module } from "@nestjs/common";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { SlackAlertService } from "./slack-alert.service";

@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, SlackAlertService],
  exports: [NotificationsService, SlackAlertService],
})
export class NotificationsModule {}
