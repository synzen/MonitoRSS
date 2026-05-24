export interface ResponseHashStore {
  get(feedId: string): Promise<string | null>;
  set(feedId: string, hash: string): Promise<void>;
  remove(feedId: string): Promise<void>;
}
