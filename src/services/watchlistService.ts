// frontend/src/services/watchlistService.ts
import api from '../api/axiosInstance';

export interface WatchlistGroup {
  id?: string;
  name: string;
  symbols: string[];
  position: number;
}

export const watchlistService = {
  async getWatchlists(): Promise<WatchlistGroup[]> {
    const { data } = await api.get('/api/watchlist');
    return data.groups;
  },

  /**
   * Syncs the entire state (useful after drag-and-drop)
   */
  async syncGroups(groups: WatchlistGroup[]) {
    const { data } = await api.post('/api/watchlist/update-groups', { groups });
    return data.success;
  },

  async addSymbol(symbol: string, groupId?: string) {
    const { data } = await api.post('/api/watchlist/add', { symbol, groupId });
    return data;
  },

  async removeSymbol(symbol: string, groupId: string) {
    const { data } = await api.post('/api/watchlist/remove', { symbol, groupId });
    return data;
  }
};
