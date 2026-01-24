export const DEFAULT_MONGODB_URI =
  "mongodb://localhost:27017/backendapi_test";

export function getBaseUri(): string {
  return process.env.BACKEND_API_MONGODB_URI || DEFAULT_MONGODB_URI;
}

export function getTestDbUri(dbName: string): string {
  const baseUri = getBaseUri();

  // Handle both standard mongodb:// and mongodb+srv:// URIs
  try {
    const url = new URL(baseUri);
    url.pathname = `/${dbName}`;
    return url.toString();
  } catch {
    // Fallback for URIs that can't be parsed as URL
    // Replace the database name after the last /
    const lastSlashIndex = baseUri.lastIndexOf("/");
    if (lastSlashIndex !== -1) {
      const queryIndex = baseUri.indexOf("?", lastSlashIndex);
      if (queryIndex !== -1) {
        return (
          baseUri.substring(0, lastSlashIndex + 1) +
          dbName +
          baseUri.substring(queryIndex)
        );
      }
      return baseUri.substring(0, lastSlashIndex + 1) + dbName;
    }
    return baseUri + "/" + dbName;
  }
}
