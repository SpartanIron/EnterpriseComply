import { Module } from "@nestjs/common";
import { AuditSharesController } from "./audit-shares.controller";
import { AuditSharesService } from "./audit-shares.service";

@Module({
  controllers: [AuditSharesController],
  providers: [AuditSharesService],
  exports: [AuditSharesService],
})
export class AuditSharesModule {}
