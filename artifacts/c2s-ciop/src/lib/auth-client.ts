import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";
import { magicLinkClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  basePath: "/api/auth",
  plugins: [
    organizationClient(),
    twoFactorClient(),
    magicLinkClient(),
  ],
});

export const { useSession, signIn, signOut, signUp } = authClient;
