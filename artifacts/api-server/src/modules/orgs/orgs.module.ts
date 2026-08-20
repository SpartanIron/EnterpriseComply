import { Module } from "@nestjs/common";
import { InvitesController } from "./invites.controller";
import { InvitesService } from "./invites.service";
import { OrgsController } from "./orgs.controller";
import { OrgsService } from "./orgs.service";

@Module({ controllers: [OrgsController, InvitesController], providers: [OrgsService, InvitesService] })
export class OrgsModule {}
