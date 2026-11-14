import type { SearchInput } from './index.js';
export type SearchHistoryEntry = {
  id: string;
  createdAt: string;
  targetName: string | null;
  input: SearchInput;
  count: number;
  total: number;
  truncated: boolean;
  sequence: { id: string; status: string; frames: number; detectors: string[] } | null;
};
export type SearchHistoryPage = { entries: SearchHistoryEntry[]; nextCursor: string | null };
