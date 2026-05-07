import { Module } from "@nestjs/common";
import { CustomFrameworksController } from "./custom-frameworks.controller";
import { CustomFrameworksService } from "./custom-frameworks.service";

@Module({ controllers: [CustomFrameworksController], providers: [CustomFrameworksService] })
export class CustomFrameworksModule {}
