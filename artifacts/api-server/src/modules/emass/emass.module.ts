import { Module } from "@nestjs/common";
import { EMassController } from "./emass.controller";
import { EMassService } from "./emass.service";

@Module({ controllers: [EMassController], providers: [EMassService], exports: [EMassService] })
export class EMassModule {}
