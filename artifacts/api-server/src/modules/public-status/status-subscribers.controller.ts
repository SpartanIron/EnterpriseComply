import { Controller, Post, Get, Delete, Body, Query } from "@nestjs/common";
import { SkipThrottle } from "@nestjs/throttler";
import { StatusSubscribersService } from "./status-subscribers.service.js";

/**
 * Public status subscription endpoints — no authentication required.
 *
 * POST   /api/public/status/subscribe        — subscribe an email
 * GET    /api/public/status/confirm?token=   — confirm subscription
 * DELETE /api/public/status/unsubscribe?token= — remove subscription
 * POST   /api/internal/status/notify         — send email to all confirmed subscribers
 */
@Controller()
@SkipThrottle()
export class StatusSubscribersController {
  constructor(private readonly svc: StatusSubscribersService) {}

  @Post("public/status/subscribe")
  subscribe(@Body() body: { email: string; orgId?: number }) {
    return this.svc.subscribe(body.email, body.orgId);
  }

  @Get("public/status/confirm")
  confirm(@Query("token") token: string) {
    return this.svc.confirm(token);
  }

  @Delete("public/status/unsubscribe")
  unsubscribe(@Query("token") token: string) {
    return this.svc.unsubscribe(token);
  }

  @Post("internal/status/notify")
  notify(
    @Body()
    body: {
      type: "incident_open" | "incident_resolve";
      component: string;
      message: string;
    },
  ) {
    return this.svc.notify(body);
  }
}
