import { Module } from "@nestjs/common";
import { ZeroTrustController } from "./zero-trust.controller";
import { ZeroTrustService } from "./zero-trust.service";

@Module({
  controllers: [ZeroTrustController],
  providers: [ZeroTrustService],
  exports: [ZeroTrustService],
})
export class ZeroTrustModule {}
