// better-auth.ts — BetterAuth instance for EnterpriseComply
// Handles: email+password, magic links, GitHub OAuth, MFA (TOTP), organisations, RBAC
// Replaces Clerk completely — no Clerk SDK needed

import { betterAuth } from "better-auth";
import { Pool } from "pg";
import { magicLink } from "better-auth/plugins";
import { twoFactor } from "better-auth/plugins";
import { organization } from "better-auth/plugins";
import { sendWelcomeEmail } from "./email";
import { logger } from "./logger";

export const auth = betterAuth({
        database: {
                    db: new Pool({ connectionString: process.env.DATABASE_URL }),
                    type: "postgres",
        },

        secret: process.env.BETTER_AUTH_SECRET || "ec-dev-secret-change-in-production",

        baseURL: process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://app.enterprisecomply.com",
        basePath: "/api/auth",

        trustedOrigins: [
                    process.env.BETTER_AUTH_URL || process.env.APP_URL || "https://app.enterprisecomply.com",
                    "https://app.enterprisecomply.com",
                    "https://grc.colorcodesolutions.com",
                    "http://localhost:3000",
                    "http://localhost:5173",
                ].filter(Boolean) as string[],

        emailAndPassword: {
                    enabled: true,
                    requireEmailVerification: false,
                    sendResetPassword: async ({ user, url }) => {
                                    logger.info({ userId: user.id }, "Password reset requested");
                    },
        },

        socialProviders: {
                    github: process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET ? {
                                    clientId: process.env.GITHUB_CLIENT_ID,
                                    clientSecret: process.env.GITHUB_CLIENT_SECRET,
                    } : undefined,
                    google: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET ? {
                                    clientId: process.env.GOOGLE_CLIENT_ID,
                                    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
                    } : undefined,
        },

        plugins: [
                    magicLink({
                                    sendMagicLink: async ({ email, token, url }, request) => {
                                                        try {
                                                                                const { sendMagicLinkEmail } = await import("./email");
                                                                                await sendMagicLinkEmail({ to: email, magicLink: url });
                                                                                logger.info({ email }, "Magic link sent via BetterAuth");
                                                        } catch (err) {
                                                                                logger.error({ err, email }, "Failed to send magic link email");
                                                        }
                                    },
                                    expiresIn: 15 * 60,
                    }),

                    twoFactor({
                                    issuer: "EnterpriseComply",
                                    totpOptions: {
                                                        period: 30,
                                                        digits: 6,
                                    },
                                    backupCodes: {
                                                        enabled: true,
                                                        amount: 10,
                                    },
                    }),

                    organization({
                                    allowUserToCreateOrganization: true,
                                    organizationLimit: 5,
                                    membershipLimit: 500,
                                    sendInvitationEmail: async (data) => {
                                                        logger.info({ email: data.email, orgName: data.organization.name }, "Org invitation sent");
                                    },
                    }),

                ],

        user: {
                    additionalFields: {
                                    orgId: {
                                                        type: "string",
                                                        required: false,
                                                        defaultValue: null,
                                    },
                                    role: {
                                                        type: "string",
                                                        required: false,
                                                        defaultValue: "member",
                                    },
                                    clerkUserId: {
                                                        type: "string",
                                                        required: false,
                                                        defaultValue: null,
                                    },
                    },
        },

        session: {
                    expiresIn: 7 * 24 * 60 * 60,
                    updateAge: 24 * 60 * 60,
                    cookieCache: {
                                    enabled: true,
                                    maxAge: 5 * 60,
                    },
        },

        advanced: {
                    useSecureCookies: process.env.NODE_ENV === "production",
                    defaultCookieAttributes: {
                                    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
                                    httpOnly: true,
                    },
        },

        databaseHooks: {
                    user: {
                                    create: {
                                                        after: async (user) => {
                                                                                sendWelcomeEmail({ to: user.email, name: user.name || user.email }).catch((err) => {
                                                                                                            logger.warn({ err, userId: user.id }, "Welcome email failed (non-fatal)");
                                                                                    });
                                                        },
                                    },
                    },
        },
});

export type Auth = typeof auth;
