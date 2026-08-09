// webhooks.controller.ts — BetterAuth lifecycle webhook controller
import { Controller, Post, Req, Res, HttpCode, Logger } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { WebhooksService } from "./webhooks.service";

// Webhook secret validation.
// Set WEBHOOK_SECRET in the environment. Callers must send the same value in
// the X-Webhook-Secret header. If the env var is unset the endpoint is
// disabled entirely — better to fail loudly than to run unprotected.
function validateWebhookSecret(req: Request, res: Response): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — reject all calls to prevent unauthenticated use.
    res.status(503).json({ error: "Webhook endpoint not configured (WEBHOOK_SECRET unset)" });
    return false;
  }
  const provided = req.headers["x-webhook-secret"];
  if (!provided || provided !== secret) {
    res.status(401).json({ error: "Invalid or missing X-Webhook-Secret header" });
    return false;
  }
  return true;
}

// High-volume throttler profile: 300 req/min per source IP.
// CI/CD pipelines and BetterAuth lifecycle hooks send bursts of webhooks;
// 300/min comfortably handles those while still blocking DoS at the wire.
@Controller("webhooks")
@Throttle({ webhook: { limit: 300, ttl: 60000 } })
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("user-created")
  @HttpCode(200)
  async handleUserCreated(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!validateWebhookSecret(req, res)) return;

    const { userId, email, firstName } = req.body ?? {};
    if (!userId || !email) {
      res.status(400).json({ error: "userId and email are required" });
      return;
    }
    try {
      await this.webhooksService.handleUserCreated(userId, email, firstName);
      res.json({ received: true });
    } catch (err) {
      this.logger.error({ err, userId }, "User lifecycle handler failed");
      res.status(500).json({ error: "Handler error" });
    }
  }
}
