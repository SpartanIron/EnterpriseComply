import { Module } from "@nestjs/common";
import { ClientPortalService } from "./client-portal.service";
import { ClientPortalController } from "./client-portal.controller";

@Module({
  providers: [ClientPortalService],
  controllers: [ClientPortalController],
  exports: [ClientPortalService],
})
export class ClientPortalModule {}
