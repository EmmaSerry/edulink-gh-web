/** Learning areas apply to "skill-checklist" levels (KG1, KG2, ...). A
 *  learning area (e.g. "Numeracy") can apply to more than one KG level. */
export interface LearningArea {
  id?: number;
  name: string;
  sortOrder: number;
  levelIds: number[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
