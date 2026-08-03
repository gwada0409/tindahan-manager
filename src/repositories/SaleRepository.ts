import { db } from '@/db/database';
import type { Sale, SaleItem } from '@/types';
import { BaseRepository } from './BaseRepository';

export const saleRepo = new BaseRepository<Sale>(db.sales);
export const saleItemRepo = new BaseRepository<SaleItem>(db.saleItems);
