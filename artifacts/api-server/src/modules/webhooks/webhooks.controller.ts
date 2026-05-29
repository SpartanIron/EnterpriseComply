// webhooks.controller.ts — BetterAuth lifecycle webhook controller
import { Controller, Post, Req, Res, HttpCode, Logger } from "@nestjs/common";
import { Request, Response } from "express";
import { WebhooksService } from "./webhooks.service";

@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("user-created")
  @HttpCode(200)
  async handleUserCreated(@Req() req: Request, @Res() res: Response): Promise<void> {
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
