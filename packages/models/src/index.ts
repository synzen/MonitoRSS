import { MongoClient } from 'mongodb';
import FeedRepository from './repositories/FeedRepository';

export interface Models {
  Feed: FeedRepository;
}

async function connect(uri: string) {
  const client = await MongoClient.connect(uri);
  const db = client.db();

  const models: Models = {
    Feed: FeedRepository.getRepository(db),
  };

  return models;
}

export default connect;
