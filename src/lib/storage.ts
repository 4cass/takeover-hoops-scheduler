
// Simple localStorage-based data persistence
// This can be replaced with Supabase later

export class LocalStorage {
  static get<T>(key: string): T[] {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static set<T>(key: string, data: T[]): void {
    localStorage.setItem(key, JSON.stringify(data));
  }

  static add<T extends { id: string }>(key: string, item: T): void {
    const items = this.get<T>(key);
    items.push(item);
    this.set(key, items);
  }

  static update<T extends { id: string }>(key: string, id: string, updates: Partial<T>): void {
    const items = this.get<T>(key);
    const index = items.findIndex(item => item.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...updates };
      this.set(key, items);
    }
  }

  static delete<T extends { id: string }>(key: string, id: string): void {
    const items = this.get<T>(key);
    const filtered = items.filter(item => item.id !== id);
    this.set(key, filtered);
  }

  static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

// Storage keys
export const STORAGE_KEYS = {
  STUDENTS: 'takeover_students',
  COACHES: 'takeover_coaches',
  BRANCHES: 'takeover_branches',
  SESSIONS: 'takeover_sessions',
  ATTENDANCE: 'takeover_attendance'
} as const;
