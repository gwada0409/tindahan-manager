export interface Repository<T> {
  getAll(): Promise<T[]>;
  getById(id: string): Promise<T | undefined>;
  add(item: T): Promise<string>;
  update(id: string, item: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}
