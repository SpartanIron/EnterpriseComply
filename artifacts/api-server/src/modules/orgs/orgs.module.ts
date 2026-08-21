import { Module } from "@nestjs/common";
import { MfaModule } from "../mfa/mfa.module";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";
import { OrgsController } from "./orgs.controller";
import { OrgsService } from "./orgs.service";

// MfaModule is imported, not re-provided: InvitesController needs MfaService for the
// administrator authenticator reset, and a second instance of that service would keep
// its own view of enrolment state. A second-factor check is the last thing that should
// be ambiguous about which copy of the truth it read.
@Module({
  imports: [MfaModule],
  controllers: [OrgsController, InvitesController],
  providers: [OrgsService, InvitesService],
})
export class OrgsModule {}
