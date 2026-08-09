import { Module } from "@nestjs/common";
import { SsoController } from "./sso.controller";
import { SamlAuthController } from "./saml-auth.controller";
import { SsoService } from "./sso.service";

@Module({
  controllers: [SsoController, SamlAuthController],
  providers:   [SsoService],
  exports:     [SsoService],
})
export class SsoModule {}
