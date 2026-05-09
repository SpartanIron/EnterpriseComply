import { Module, NestModule, MiddlewareConsumer } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { clerkMiddleware } from "@clerk/express";
import { ClerkProxyMiddleware, CLERK_PROXY_PATH } from "./middlewares/clerk-proxy.middleware";
import { StartupModule } from "./startup/startup.module";
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
import { RisksModule } from "./modules/risks/risks.module";
import { AuditsModule } from "./modules/audits/audits.module";
import { QuestionnairesModule } from "./modules/questionnaires/questionnaires.module";
import { AssessmentsModule } from "./modules/assessments/assessments.module";
import { SprsModule } from "./modules/sprs/sprs.module";
import { SspModule } from "./modules/ssp/ssp.module";
import { TrustCenterModule } from "./modules/trust-center/trust-center.module";
import { MonitoringModule } from "./modules/monitoring/monitoring.module";
import { AccessReviewsModule } from "./modules/access-reviews/access-reviews.module";
import { CustomFrameworksModule } from "./modules/custom-frameworks/custom-frameworks.module";
import { ScoreHistoryModule } from "./modules/score-history/score-history.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { GapAnalysisModule } from "./modules/gap-analysis/gap-analysis.module";
import { TestRunsModule } from "./modules/test-runs/test-runs.module";
import { StigsModule } from "./modules/stigs/stigs.module";
import { RemediationModule } from "./modules/remediation/remediation.module";
import { AuditSharesModule } from "./modules/audit-shares/audit-shares.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    StartupModule,
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
    RisksModule,
    AuditsModule,
    QuestionnairesModule,
    AssessmentsModule,
    SprsModule,
    SspModule,
    TrustCenterModule,
    MonitoringModule,
    AccessReviewsModule,
    CustomFrameworksModule,
    ScoreHistoryModule,
    NotificationsModule,
    GapAnalysisModule,
    TestRunsModule,
    StigsModule,
    RemediationModule,
    AuditSharesModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ClerkProxyMiddleware)
      .forRoutes(CLERK_PROXY_PATH);
    consumer
      .apply(clerkMiddleware())
      .forRoutes("*path");
  }
  }
