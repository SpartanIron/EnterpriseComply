import { getAuth } from "@clerk/express";
import { db, orgMembersTable, organizationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

export interface AuthRequest extends Request {
  clerkUserId?: string;
  orgId?: number;
  org?: typeof organizationsTable.$inferSelect;
  member?: typeof orgMembersTable.$inferSelect;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = userId;
  next();
};

export const requireOrg = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  req.clerkUserId = userId;

  try {
    const member = await db.query.orgMembersTable.findFirst({
      where: eq(orgMembersTable.clerkUserId, userId),
    });
    if (!member) return res.status(404).json({ error: "no_org", message: "No organization found. Complete onboarding." });

    const org = await db.query.organizationsTable.findFirst({
      where: eq(organizationsTable.id, member.orgId),
    });
    if (!org) return res.status(404).json({ error: "no_org" });

    req.orgId = member.orgId;
    req.org = org;
    req.member = member;
    next();
  } catch (err) {
    next(err);
  }
};
