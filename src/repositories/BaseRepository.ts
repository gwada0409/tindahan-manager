import { Table } from 'dexie';
import { Repository } from './index';
import { db, TindahanDB } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

export class BaseRepository<T extends { id: string }> implements Repository<T> {
  protected table: Table<T, string>;

  constructor(table: Table<T, string>) {
    this.table = table;
  }

  async getAll(): Promise<T[]> {
    return await this.table.toArray();
  }

  async getById(id: string): Promise<T | undefined> {
    return await this.table.get(id);
  }

  async add(item: Omit<T, 'id'>): Promise<string> {
    const id = uuidv4();
    const itemWithId = { ...item, id } as T;
    await this.table.add(itemWithId);
    return id;
  }

  async update(id: string, item: Partial<T>): Promise<void> {
    await this.table.update(id, item as any);
  }

  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }
}
