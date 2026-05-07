import { Module } from "@nestjs/common";
import { PoamController } from "./poam.controller";
import { PoamService } from "./poam.service";

@Module({ controllers: [PoamController], providers: [PoamService] })
export class PoamModule {}
