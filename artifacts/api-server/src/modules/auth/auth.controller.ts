import { All, Controller, Req, Res } from "@nestjs/common";
import { toNodeHandler } from "better-auth/node";
import { auth } from "../../lib/better-auth";
import type { Request, Response } from "express";

// BetterAuth controller — handles ALL /api/auth/* routes
// toNodeHandler converts BetterAuth fetch-based handler to Node.js/Express compatible handler
@Controller("auth")
export class AuthController {
  private readonly handler = toNodeHandler(auth);

  @All("*path")
  async handleAuth(@Req() req: Request, @Res() res: Response) {
    return this.handler(req, res);
  }
}
