import { MongoClient, ObjectId } from "mongodb";
import { MONGO_URI } from "./constants";

/**
 * Seed a REVOKED personal Reddit credential directly, simulating a previously connected
 * account whose grant has since died (revoked at Reddit / failed refresh). The reddit
 * gate then renders its "Reconnect" state instead of the first-time connect copy.
 */
export async function seedRevokedRedditCredentialInDb(discordUserId: string): Promise<void> {
  const client = new MongoClient(MONGO_URI, { directConnection: true });

  try {
    await client.connect();
    await client
      .db()
      .collection("users")
      .updateOne(
        { discordUserId },
        {
          $set: {
            externalCredentials: [
              { _id: new ObjectId(), type: "reddit", status: "REVOKED", data: {} },
            ],
          },
        },
      );
  } finally {
    await client.close();
  }
}
