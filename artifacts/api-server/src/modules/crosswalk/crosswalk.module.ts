import { Module } from "@nestjs/common";
import { CrosswalkController } from "./crosswalk.controller";

@Module({ controllers: [CrosswalkController] })
export class CrosswalkModule {}
