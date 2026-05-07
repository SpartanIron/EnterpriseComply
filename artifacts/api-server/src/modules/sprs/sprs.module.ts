import { Module } from "@nestjs/common";
import { SprsController } from "./sprs.controller";
import { SprsService } from "./sprs.service";

@Module({ controllers: [SprsController], providers: [SprsService] })
export class SprsModule {}
