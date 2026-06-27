import matchers from "@testing-library/jest-dom/matchers";
import { expect, afterAll, afterEach, beforeAll } from "vitest";
import { testServer } from "./src/mocks/testServer";

expect.extend(matchers);

beforeAll(() => testServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => testServer.resetHandlers());
afterAll(() => testServer.close());
