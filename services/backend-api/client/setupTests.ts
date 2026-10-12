import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { testServer } from "./src/mocks/testServer";

beforeAll(() => testServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => testServer.resetHandlers());
afterAll(() => testServer.close());
