// platform.module.ts — wires the break-glass controller into the app
//
// Imports MfaModule rather than providing MfaService itself. Two instances of that
// service would each keep their own view of enrolment state, and the one thing a
// second-factor check must not be is ambiguous.

import { Module } from "@nestjs/common";
import { MfaModule } from "../mfa/mfa.module";
import { PlatformController } from "./platform.controller";

@Module({
  imports: [MfaModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
