import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { GradeBand } from "@models/GradeBand";

class GradeBandServiceImpl extends BaseRepository<GradeBand> {
  constructor() {
    super(db.gradeBands);
  }
}

export const GradeBandService = new GradeBandServiceImpl();
