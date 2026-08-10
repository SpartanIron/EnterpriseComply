import { Module } from "@nestjs/common";
import { EvidenceController } from "./evidence.controller";
import { EvidenceService } from "./evidence.service";
import { WormLedgerService } from "./worm-ledger.service";

@Module({ controllers: [EvidenceController], providers: [EvidenceService, WormLedgerService],
  exports: [WormLedgerService] })
export class EvidenceModule {}
