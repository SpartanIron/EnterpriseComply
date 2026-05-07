import { Module } from "@nestjs/common";
import { TrustCenterController } from "./trust-center.controller";
import { TrustCenterService } from "./trust-center.service";

@Module({ controllers: [TrustCenterController], providers: [TrustCenterService] })
export class TrustCenterModule {}
