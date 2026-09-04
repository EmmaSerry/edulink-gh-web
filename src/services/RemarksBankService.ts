import { db } from "@database/db";
import { BaseRepository } from "./BaseRepository";
import type { RemarksBankEntry } from "@models/RemarksBank";

class RemarksBankServiceImpl extends BaseRepository<RemarksBankEntry> {
  constructor() {
    super(db.remarksBank);
  }
}

export const RemarksBankService = new RemarksBankServiceImpl();
