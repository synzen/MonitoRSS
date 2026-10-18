export type PaddleEnvironment = "production" | "sandbox";

const explicitPaddleEnvironment = import.meta.env.VITE_PADDLE_ENVIRONMENT;

const isExplicitPaddleEnvironment =
  explicitPaddleEnvironment === "production" || explicitPaddleEnvironment === "sandbox";

const buildModePaddleEnvironment: PaddleEnvironment = import.meta.env.PROD
  ? "production"
  : "sandbox";

/**
 * Which Paddle world the client talks to, decided independently of the build
 * mode. Any `vite build` bakes `import.meta.env.PROD` as true, so without an
 * explicit override E2E builds would be stuck on production Paddle —
 * VITE_PADDLE_ENVIRONMENT=sandbox keeps a built client on the sandbox API and
 * sandbox price IDs.
 */
export const PADDLE_ENVIRONMENT: PaddleEnvironment = isExplicitPaddleEnvironment
  ? (explicitPaddleEnvironment as PaddleEnvironment)
  : buildModePaddleEnvironment;
