export interface IDiscoverySearchEvent {
  id: string;
  searchTerm: string;
  resultCount: number;
  createdAt: Date;
}

export interface IDiscoverySearchEventRepository {
  create(event: Omit<IDiscoverySearchEvent, "id">): Promise<void>;
}
