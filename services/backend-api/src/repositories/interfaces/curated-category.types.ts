import type { ClientSession } from "mongoose";

export interface ICuratedCategory {
  id: string;
  categoryId: string;
  label: string;
}

export interface ICuratedCategoryRepository {
  getAll(): Promise<ICuratedCategory[]>;
  replaceAll(
    categories: Omit<ICuratedCategory, "id">[],
    session?: ClientSession,
  ): Promise<void>;
  deleteAll(session?: ClientSession): Promise<void>;
}
