import { Controller, Get } from "@nestjs/common";

/**
 * P1-21: Public endpoint — intentionally no auth guard.
 * Returns which OAuth providers are active in this deployment.
 * Frontend uses this to conditionally render sign-in buttons,
 * preventing silent failures when credentials are not configured.
 * This exposes only boolean flags, no secrets.
 */
@Controller()
export class ProvidersController {
  @Get("auth-providers")
  getActiveProviders() {
    return {
      google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
    };
  }
}
