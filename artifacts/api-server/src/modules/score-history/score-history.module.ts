import { Module } from "@nestjs/common";
import { ScoreHistoryController } from "./score-history.controller";
import { ScoreHistoryService } from "./score-history.service";

@Module({ controllers: [ScoreHistoryController], providers: [ScoreHistoryService] })
export class ScoreHistoryModule {}
