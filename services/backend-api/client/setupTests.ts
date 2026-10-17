import "@testing-library/jest-dom/vitest";
import { MotionGlobalConfig } from "motion-utils";
import { afterAll, afterEach, beforeAll } from "vitest";
import { testServer } from "./src/mocks/testServer";

MotionGlobalConfig.skipAnimations = true;

beforeAll(() => testServer.listen({ onUnhandledFrame: "error" }));
afterEach(() => testServer.resetHandlers());
afterAll(() => testServer.close());
