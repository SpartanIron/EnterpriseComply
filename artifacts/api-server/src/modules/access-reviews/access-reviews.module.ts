import { Module } from "@nestjs/common";
import { AccessReviewsController } from "./access-reviews.controller";
import { AccessReviewsService } from "./access-reviews.service";

@Module({ controllers: [AccessReviewsController], providers: [AccessReviewsService] })
export class AccessReviewsModule {}
