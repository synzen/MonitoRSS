const INSTANCE = process.env.E2E_INSTANCE || "0";

export const instanceSuffix = INSTANCE === "0" ? "" : `.${INSTANCE}`;
