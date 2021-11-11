import { MongoClient } from 'mongodb';
import Feed from './repositories/FeedRepository';

async function connect(uri: string) {
  const client = await MongoClient.connect(uri);
  const db = client.db();

  return {
    Feed: Feed.getRepository(db),
  };
}

export default connect;
