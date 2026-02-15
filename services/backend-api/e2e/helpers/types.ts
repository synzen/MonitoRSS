export interface Feed {
  id: string;
  title: string;
  url: string;
}

export interface Connection {
  id: string;
  name: string;
  key: string;
}

export interface FeedWithConnection {
  feed: Feed;
  connection: Connection;
}
