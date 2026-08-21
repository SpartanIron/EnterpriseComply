import { Module } from "@nestjs/common";
import { PostureController } from "./posture.controller";

/**
 * No providers: the posture computation is a pure function over the database in
 * lib/posture.ts rather than an injectable service. It is called from the
 * controller and from OrgsService's shadow path, and a plain function keeps
 * those two call sites from needing to share a Nest provider graph.
 */
@Module({ controllers: [PostureController] })
export class PostureModule {}
