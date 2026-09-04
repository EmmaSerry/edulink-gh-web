import type { Table } from "dexie";

/**
 * Generic repository providing consistent CRUD semantics over a Dexie
 * table. Concrete Phase 1 services (SchoolService, StudentService, ...)
 * extend this instead of re-implementing add/update/remove per entity -
 * "separate business logic from presentation" and "avoid duplicated
 * code" per the coding standards in docs/CODING_STANDARDS.md.
 *
 * This class intentionally contains no domain/business logic (no
 * grading, ranking, or report rules) - that belongs to Phase 1+ services
 * (e.g. a future ScoreCalculationService), never to the repository layer.
 */
export abstract class BaseRepository<T, Key extends IndexableType = number> {
  protected constructor(protected readonly table: Table<T, Key>) {}

  async getAll(): Promise<T[]> {
    return this.table.toArray();
  }

  async getById(id: Key): Promise<T | undefined> {
    return this.table.get(id);
  }

  async create(record: Omit<T, "id">): Promise<Key> {
    return this.table.add(record as T);
  }

  async update(id: Key, changes: Partial<T>): Promise<number> {
    return this.table.update(id, changes as object);
  }

  async remove(id: Key): Promise<void> {
    await this.table.delete(id);
  }

  async count(): Promise<number> {
    return this.table.count();
  }
}

// Re-exported so subclasses don't need a direct dexie import just for the type.
export type IndexableType = string | number;
