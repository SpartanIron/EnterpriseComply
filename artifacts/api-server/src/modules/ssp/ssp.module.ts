import { Module } from "@nestjs/common";
import { SspController } from "./ssp.controller";
import { SspService } from "./ssp.service";

@Module({ controllers: [SspController], providers: [SspService] })
export class SspModule {}
