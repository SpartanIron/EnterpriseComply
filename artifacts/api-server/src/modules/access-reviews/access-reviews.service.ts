import { Injectable, NotFoundException } from "@nestjs/common";
import {
  db, orgAccessReviewsTable, orgAccessReviewItemsTable, orgPeopleTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

@Injectable()
export class AccessReviewsService {
  async getReviews(orgId: number) {
    const reviews = await db.query.orgAccessReviewsTable.findMany({
      where: eq(orgAccessReviewsTable.orgId, orgId),
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    });
    return { reviews };
  }

  async createReview(orgId: number, clerkUserId: string, body: {
    name: string; description?: string; dueDate?: string;
  }) {
    const people = await db.query.orgPeopleTable.findMany({
      where: and(eq(orgPeopleTable.orgId, orgId), eq(orgPeopleTable.active, true)),
    });

    const [review] = await db.insert(orgAccessReviewsTable).values({
      orgId,
      name: body.name,
      description: body.description,
      totalPeople: people.length,
      pendingCount: people.length,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      createdBy: clerkUserId,
    }).returning();

    const items = people.map((p) => ({
      orgId,
      reviewId: review.id,
      personId: p.id,
      personEmail: p.email,
      personName: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.email,
      personTitle: p.title,
      personDepartment: p.department,
      systems: ["Main Application", "Cloud Storage", "Code Repository"].slice(0, Math.floor(Math.random() * 3) + 1),
    }));

    if (items.length > 0) {
      await db.insert(orgAccessReviewItemsTable).values(items);
    }

    return { review: { ...review, itemCount: items.length } };
  }

  async getReviewItems(orgId: number, reviewId: number) {
    const items = await db.query.orgAccessReviewItemsTable.findMany({
      where: and(
        eq(orgAccessReviewItemsTable.orgId, orgId),
        eq(orgAccessReviewItemsTable.reviewId, reviewId),
      ),
    });
    return { items };
  }

  async submitDecision(orgId: number, reviewId: number, itemId: number, body: {
    decision: "approved" | "revoked"; reviewerName: string; reviewerEmail: string; notes?: string;
  }) {
    const [item] = await db.update(orgAccessReviewItemsTable)
      .set({
        decision: body.decision,
        reviewerName: body.reviewerName,
        reviewerEmail: body.reviewerEmail,
        notes: body.notes,
        reviewedAt: new Date(),
      })
      .where(and(
        eq(orgAccessReviewItemsTable.orgId, orgId),
        eq(orgAccessReviewItemsTable.reviewId, reviewId),
        eq(orgAccessReviewItemsTable.id, itemId),
      ))
      .returning();

    const allItems = await db.query.orgAccessReviewItemsTable.findMany({
      where: and(
        eq(orgAccessReviewItemsTable.orgId, orgId),
        eq(orgAccessReviewItemsTable.reviewId, reviewId),
      ),
    });
    const approved = allItems.filter((i) => i.decision === "approved").length;
    const revoked = allItems.filter((i) => i.decision === "revoked").length;
    const pending = allItems.filter((i) => !i.decision).length;
    const isComplete = pending === 0;

    await db.update(orgAccessReviewsTable)
      .set({
        approvedCount: approved,
        revokedCount: revoked,
        pendingCount: pending,
        status: isComplete ? "completed" : "in_progress",
        completedAt: isComplete ? new Date() : undefined,
      })
      .where(eq(orgAccessReviewsTable.id, reviewId));

    return { item };
  }

  async completeReview(orgId: number, reviewId: number) {
    const [review] = await db.update(orgAccessReviewsTable)
      .set({ status: "completed", completedAt: new Date() })
      .where(and(
        eq(orgAccessReviewsTable.orgId, orgId),
        eq(orgAccessReviewsTable.id, reviewId),
      ))
      .returning();
    return { review };
  }
}
