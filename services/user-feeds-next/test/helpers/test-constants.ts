export const TEMPLATE_DB_NAME = "userfeeds_template";

export const DEFAULT_POSTGRES_URI = "postgres://postgres:postgres@localhost:5433/userfeeds_test";

export function getBaseUri(): string {
  return process.env.USER_FEEDS_POSTGRES_URI || DEFAULT_POSTGRES_URI;
}

export function getAdminUri(): string {
  return getBaseUri().replace(/\/[^/]+$/, "/postgres");
}

export function getTemplateDbUri(): string {
  return getBaseUri().replace(/\/[^/]+$/, `/${TEMPLATE_DB_NAME}`);
}

export function getTestDbUri(dbName: string): string {
  return getBaseUri().replace(/\/[^/]+$/, `/${dbName}`);
}
