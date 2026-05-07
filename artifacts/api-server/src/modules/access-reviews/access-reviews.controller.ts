import { Controller, Get, Post, Patch, Body, Param, UseGuards } from "@nestjs/common";
import { AccessReviewsService } from "./access-reviews.service";
import { OrgContextGuard, OrgContext, ClerkUserId } from "../../guards/clerk-auth.guard";

interface OrgCtx { orgId: number; org: Record<string, unknown>; member: Record<string, unknown>; }

@Controller()
export class AccessReviewsController {
  constructor(private readonly accessReviewsService: AccessReviewsService) {}

  @Get("orgs/:orgId/access-reviews")
  @UseGuards(OrgContextGuard)
  getReviews(@OrgContext() ctx: OrgCtx) {
    return this.accessReviewsService.getReviews(ctx.orgId);
  }

  @Post("orgs/:orgId/access-reviews")
  @UseGuards(OrgContextGuard)
  createReview(@OrgContext() ctx: OrgCtx, @ClerkUserId() userId: string, @Body() body: any) {
    return this.accessReviewsService.createReview(ctx.orgId, userId, body);
  }

  @Get("orgs/:orgId/access-reviews/:id/items")
  @UseGuards(OrgContextGuard)
  getItems(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.accessReviewsService.getReviewItems(ctx.orgId, Number(id));
  }

  @Patch("orgs/:orgId/access-reviews/:id/items/:itemId")
  @UseGuards(OrgContextGuard)
  submitDecision(@OrgContext() ctx: OrgCtx, @Param("id") id: string, @Param("itemId") itemId: string, @Body() body: any) {
    return this.accessReviewsService.submitDecision(ctx.orgId, Number(id), Number(itemId), body);
  }

  @Patch("orgs/:orgId/access-reviews/:id/complete")
  @UseGuards(OrgContextGuard)
  completeReview(@OrgContext() ctx: OrgCtx, @Param("id") id: string) {
    return this.accessReviewsService.completeReview(ctx.orgId, Number(id));
  }
}
