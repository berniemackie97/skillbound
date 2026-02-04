/**
 * Progression tracking types
 */

export type ProgressionItemType = 'unlock' | 'item' | 'gear' | 'goal' | 'custom';

export interface ProgressionItem {
  id: string;
  userCharacterId: string;
  categoryId: string | null;
  itemType: ProgressionItemType;
  name: string;
  description: string | null;
  itemId: number | null;
  unlockFlag: string | null;
  completed: boolean;
  completedAt: Date | null;
  notes: string | null;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProgressionCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  orderIndex: number;
  items?: ProgressionItem[];
  completedCount?: number;
  totalCount?: number;
}

export interface ProgressionStats {
  totalItems: number;
  completedItems: number;
  completionPercentage: number;
  byCategory: {
    categoryId: string;
    categoryName: string;
    total: number;
    completed: number;
    percentage: number;
  }[];
  recentlyCompleted: ProgressionItem[];
}

export interface CreateProgressionItemInput {
  categoryId?: string;
  itemType: ProgressionItemType;
  name: string;
  description?: string;
  itemId?: number;
  unlockFlag?: string;
  orderIndex?: number;
}

export interface UpdateProgressionItemInput {
  name?: string;
  description?: string;
  completed?: boolean;
  notes?: string;
  orderIndex?: number;
}

export interface BulkImportProgressionInput {
  templateId: string;
  categoryIds?: string[]; // Optional filter for which categories to import
}
