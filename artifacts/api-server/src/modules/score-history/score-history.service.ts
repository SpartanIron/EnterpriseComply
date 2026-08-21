import { Injectable } from "@nestjs/common";
import { readScoreHistory, recordScoreSnapshot } from "../../lib/score-history";

/**
 * Thin wrapper by design. The read rule and the write rule live in
 * lib/score-history.ts so the boot-time snapshot and the HTTP endpoint cannot
 * drift apart, and so the regression guard can exercise both without standing
 * up a Nest module.
 *
 * The ninety-day generator that used to live in this file is gone. See the
 * module comment in lib/score-history.ts for what it produced and why deleting
 * it was the fix rather than correcting its arithmetic.
 */
@Injectable()
export class ScoreHistoryService {
  async getHistory(orgId: number) {
    return readScoreHistory(orgId);
  }

  async recordSnapshot(orgId: number) {
    return recordScoreSnapshot(orgId);
  }
}
