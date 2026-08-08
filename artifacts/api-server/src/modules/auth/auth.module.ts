import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { ProvidersController } from "./providers.controller";

@Module({
  controllers: [AuthController, ProvidersController],
})
export class AuthModule {}
