/** Individual checklist skills within a KG Learning Area, scoped to one
 *  specific KG level (skill wording/count can differ between KG1 and
 *  KG2 even within the same Learning Area), from the official NaCCA KG
 *  Assessment Tool. Fully editable so future NaCCA revisions are a data
 *  change, not a redeploy. */
export interface Skill {
  id?: number;
  learningAreaId: number;
  levelId: number;
  /** S/N as printed on the form. */
  serialNumber: number;
  description: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
