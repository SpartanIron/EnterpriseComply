import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { clerkMiddleware } from "@clerk/express";
import { ClerkProxyMiddleware, CLERK_PROXY_PATH } from "./middlewares/clerk-proxy.middleware";
import { HealthModule } from "./modules/health/health.module";
import { OrgsModule } from "./modules/orgs/orgs.module";
import { FrameworksModule } from "./modules/frameworks/frameworks.module";
import { ControlsModule } from "./modules/controls/controls.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { EvidenceModule } from "./modules/evidence/evidence.module";
import { PoamModule } from "./modules/poam/poam.module";
import { PeopleModule } from "./modules/people/people.module";
import { VendorsModule } from "./modules/vendors/vendors.module";
import { PoliciesModule } from "./modules/policies/policies.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    OrgsModule,
    FrameworksModule,
    ControlsModule,
    IntegrationsModule,
    EvidenceModule,
    PoamModule,
    PeopleModule,
    VendorsModule,
    PoliciesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClerkProxyMiddleware)
      .forRoutes(CLERK_PROXY_PATH);

    consumer
      .apply(clerkMiddleware())
      .forRoutes("*");
  }
}
