import { Module } from "@nestjs/common";
import { ScapService } from "./scap.service";
import { ScapController } from "./scap.controller";

@Module({
  providers: [ScapService],
  controllers: [ScapController],
  exports: [ScapService],
})
export class ScapModule {}
