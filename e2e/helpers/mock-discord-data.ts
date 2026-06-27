interface SessionAccessToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
  expiresAt: number;
  discord: {
    id: string;
    email?: string;
  };
}

export const MOCK_DISCORD_USER_ID = "900000000000000001";
// Fixed Discord id for a site-admin actor. Must match BACKEND_API_ADMIN_USER_IDS
// in docker-compose.e2e.yml; the admin check accepts Discord ids, so this stable
// value identifies an admin even though internal ids are minted at runtime.
export const E2E_ADMIN_DISCORD_ID = "900000000000000099";
export const MOCK_DISCORD_BOT_ID = "800000000000000001";
export const MOCK_DISCORD_GUILD_ID = "700000000000000001";
export const MOCK_DISCORD_CHANNEL_ID = "600000000000000001";
export const MOCK_DISCORD_CHANNEL_2_ID = "600000000000000002";
export const MOCK_DISCORD_FORUM_CHANNEL_ID = "600000000000000003";
export const MOCK_DISCORD_ROLE_ID = "500000000000000001";

// The mock user's email. The whole billing suite authenticates as this user, so
// its Paddle customer is keyed to this email. Cleanup is scoped to it so the
// suite only ever cancels its OWN sandbox subscriptions, never a dev stack's (or
// another developer's) that happens to share the single sandbox account.
export const MOCK_USER_EMAIL = "e2e-test@example.com";

export const MOCK_DISCORD_USER = {
  id: MOCK_DISCORD_USER_ID,
  username: "e2e-test-user",
  discriminator: "0",
  avatar: null,
  global_name: "E2E Test User",
  email: MOCK_USER_EMAIL,
};

export const MOCK_DISCORD_BOT_USER = {
  id: MOCK_DISCORD_BOT_ID,
  username: "MonitoRSS",
  discriminator: "0",
  avatar: null,
  bot: true,
};

export const MOCK_DISCORD_GUILD = {
  id: MOCK_DISCORD_GUILD_ID,
  name: "E2E Test Server",
  icon: null,
  owner: true,
  owner_id: MOCK_DISCORD_USER_ID,
  permissions: "1099511627775",
  features: [],
};

export const MOCK_DISCORD_CHANNELS = [
  {
    id: MOCK_DISCORD_CHANNEL_ID,
    type: 0,
    guild_id: MOCK_DISCORD_GUILD_ID,
    name: "e2e-test-channel",
    position: 0,
    permission_overwrites: [],
    topic: null,
    nsfw: false,
    parent_id: null,
  },
  {
    id: MOCK_DISCORD_CHANNEL_2_ID,
    type: 0,
    guild_id: MOCK_DISCORD_GUILD_ID,
    name: "e2e-test-channel-2",
    position: 1,
    permission_overwrites: [],
    topic: null,
    nsfw: false,
    parent_id: null,
  },
  {
    id: MOCK_DISCORD_FORUM_CHANNEL_ID,
    type: 15,
    guild_id: MOCK_DISCORD_GUILD_ID,
    name: "e2e-test-forum",
    position: 2,
    permission_overwrites: [],
    topic: null,
    nsfw: false,
    parent_id: null,
    available_tags: [],
  },
];

export const MOCK_DISCORD_ROLES = [
  {
    id: MOCK_DISCORD_GUILD_ID,
    name: "@everyone",
    color: 0,
    hoist: false,
    position: 0,
    permissions: "1099511627775",
    managed: false,
    mentionable: false,
  },
  {
    id: MOCK_DISCORD_ROLE_ID,
    name: "Test Role",
    color: 3447003,
    hoist: false,
    position: 1,
    permissions: "1071698529857",
    managed: false,
    mentionable: true,
  },
];

export function createMockSessionToken(): SessionAccessToken {
  return {
    access_token: `mock-token-${MOCK_DISCORD_USER_ID}`,
    token_type: "Bearer",
    expires_in: 604800,
    refresh_token: "mock-refresh-token",
    scope: "identify guilds",
    expiresAt: Math.floor(Date.now() / 1000) + 604800,
    discord: { id: MOCK_DISCORD_USER_ID, email: "e2e-test@example.com" },
  };
}
