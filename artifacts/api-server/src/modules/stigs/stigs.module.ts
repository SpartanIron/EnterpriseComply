import { Module } from "@nestjs/common";
import { StigsController } from "./stigs.controller";
import { StigsService } from "./stigs.service";

@Module({ controllers: [StigsController], providers: [StigsService] })
export class StigsModule {}
