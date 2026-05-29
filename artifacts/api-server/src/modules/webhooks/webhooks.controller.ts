import { Controller, Post, Req, Res, HttpCode, Logger } from "@nestjs/common";
import { Request, Response } from "express";
import { WebhooksService } from "./webhooks.service";

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * POST /api/webhooks/clerk
   * Receives signed Clerk webhook events.
   * Clerk sends the raw body + svix-id, svix-timestamp, svix-signature headers.
   * Body must be read as raw Buffer (not parsed JSON) for signature verification.
   */
  @Post("clerk")
  @HttpCode(200)
  async handleClerkWebhook(@Req() req: Request, @Res() res: Response): Promise<void> {
    let payload: any;
    try {
      const headers: Record<string, string> = {
        "svix-id": req.headers["svix-id"] as string,
        "svix-timestamp": req.headers["svix-timestamp"] as string,
        "svix-signature": req.headers["svix-signature"] as string,
      };
      const rawBody = (req as any).rawBody ?? Buffer.from(JSON.stringify(req.body));
      payload = this.webhooksService.verifyAndParse(rawBody, headers);
    } catch (err) {
      this.logger.warn({ err }, "Clerk webhook signature verification failed");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    const eventType: string = (payload as any)?.type;
    this.logger.log(`Clerk webhook received: ${eventType}`);

    try {
      switch (eventType) {
        case "user.created":
          await this.webhooksService.handleUserCreated(payload);
          break;
        case "organizationMembership.created":
          await this.webhooksService.handleOrgMembershipCreated(payload);
          break;
        default:
          // Unhandled event type — acknowledge and ignore
          this.logger.debug(`Unhandled Clerk event: ${eventType}`);
      }
      res.json({ received: true });
    } catch (err) {
      this.logger.error({ err, eventType }, "Clerk webhook handler failed");
      // Return 200 to prevent Clerk from retrying — log the error for manual review
      res.json({ received: true, warning: "Handler error logged" });
    }
  }
}
