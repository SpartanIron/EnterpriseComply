import { Module, NestModule, MiddlewareConsumer, RequestMethod } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { PgThrottlerStorage } from "./lib/pg-throttler-storage.js";
import { RateLimitGuard } from "./guards/rate-limit.guard";
import { AuditInterceptor } from "./interceptors/audit.interceptor";
import { SecurityExceptionFilter } from "./interceptors/security-exception.filter";
import { AuthModule } from "./modules/auth/auth.module";
import { MfaModule } from "./modules/mfa/mfa.module";
import { StartupModule } from "./startup/startup.module";
import { HealthModule } from "./modules/health/health.module";
import { OrgsModule } from "./modules/orgs/orgs.module";
import { FrameworksModule } from "./modules/frameworks/frameworks.module";
import { ControlsModule } from "./modules/controls/controls.module";
import { PostureModule } from "./modules/posture/posture.module";
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
import { ClientPortalModule } from "./modules/client-portal/client-portal.module";
import { ScapModule } from "./modules/scap/scap.module";
import { AuditSharesModule } from "./modules/audit-shares/audit-shares.module";
import { GoogleWorkspaceModule } from "./modules/google-workspace/google-workspace.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { ZeroTrustModule } from "./modules/zero-trust/zero-trust.module";
import { WebhooksModule } from "./modules/webhooks/webhooks.module";
import { SchedulerModule } from "./modules/scheduler/scheduler.module";
import { TelemetryModule } from "./modules/telemetry/telemetry.module";
import { EMassModule } from "./modules/emass/emass.module";
import { PublicStatusModule } from "./modules/public-status/public-status.module";
import { SsoModule } from "./modules/sso/sso.module";
import { AdminModule } from "./modules/admin/admin.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { CrosswalkModule } from "./modules/crosswalk/crosswalk.module";
import { IdleTimeoutMiddleware } from "./middlewares/idle-timeout.middleware";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Named throttler profiles — applied selectively by RateLimitGuard:
    //   "default"  → authenticated API endpoints     (120 req/60s per IP)
    //   "auth"     → auth/SAML endpoints             (  5 req/60s per IP)
    //   "webhook"  → inbound CI/CD webhook endpoint  (300 req/60s per IP)
    // Public endpoints (health, status page) use @SkipThrottle() to bypass all profiles.
    //
    // storage: PgThrottlerStorage — persists hit counters in Postgres so that
    // a rolling Railway deploy or process restart does NOT reset throttle windows.
    ThrottlerModule.forRoot({
      storage: new PgThrottlerStorage(),
      throttlers: [
        { name: "default", ttl: 60000, limit: 120 },
        { name: "auth",    ttl: 60000, limit: 5   },
        { name: "webhook", ttl: 60000, limit: 300  },
      ],
    }),
    AuthModule,
    MfaModule,
    StartupModule,
    HealthModule,
    OrgsModule,
    FrameworksModule,
    ControlsModule,
    PostureModule,
    IntegrationsModule,
    EvidenceModule,
    PoamModule,
    PeopleModule,
    VendorsModule,
    PoliciesModule,
    TelemetryModule,
    EMassModule,
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
    ScapModule,
    ClientPortalModule,
    GoogleWorkspaceModule,
    AssetsModule,
    ZeroTrustModule,
    WebhooksModule,
    SchedulerModule,
    PublicStatusModule,
    SsoModule,
    AdminModule,
    // The break-glass elevation routes. Registered here, and the omission of this
    // one line is what left assertPlatformAccess() unsatisfiable and every
    // /api/admin/* endpoint answering 403 with no way for anyone to clear it.
    PlatformModule,
    CrosswalkModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
    {
      // Audit coverage is a platform property, not a per-module choice.
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      // Guards run before interceptors, so authorisation denials are only
      // visible here. Without this filter the most security-relevant events
      // on the platform would never be recorded.
      provide: APP_FILTER,
      useClass: SecurityExceptionFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Idle session timeout middleware — enforces 30-min idle limit (NIST AC-12)
    // Applied to all API routes; /api/auth/* and /api/health are skipped internally
    consumer
      .apply(IdleTimeoutMiddleware)
      .forRoutes({ path: "api/*path", method: RequestMethod.ALL });
  }
}
