import { describe, it } from "node:test";
import assert from "node:assert";
import { createFromFormatter } from "../../src/infra/email-from";
import type { Config } from "../../src/config";

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    BACKEND_API_SMTP_FROM: undefined,
    BACKEND_API_SMTP_FROM_DOMAIN: undefined,
    ...overrides,
  } as Config;
}

describe("createFromFormatter", () => {
  it("uses the override verbatim for every purpose when BACKEND_API_SMTP_FROM is set", () => {
    const formatFrom = createFromFormatter(
      makeConfig({
        BACKEND_API_SMTP_FROM: '"Only Sender" <only@somewhere.com>',
        BACKEND_API_SMTP_FROM_DOMAIN: "ignored.com",
      }),
    );

    assert.strictEqual(
      formatFrom("MonitoRSS Alerts", "alerts"),
      '"Only Sender" <only@somewhere.com>',
    );
    assert.strictEqual(
      formatFrom("MonitoRSS", "noreply"),
      '"Only Sender" <only@somewhere.com>',
    );
  });

  it("uses per-purpose senders on the configured domain", () => {
    const formatFrom = createFromFormatter(
      makeConfig({ BACKEND_API_SMTP_FROM_DOMAIN: "mydomain.com" }),
    );

    assert.strictEqual(
      formatFrom("MonitoRSS Alerts", "alerts"),
      '"MonitoRSS Alerts" <alerts@mydomain.com>',
    );
    assert.strictEqual(
      formatFrom("MonitoRSS", "noreply"),
      '"MonitoRSS" <noreply@mydomain.com>',
    );
  });

  it("throws when invoked with neither override nor domain configured", () => {
    const formatFrom = createFromFormatter(makeConfig());

    assert.throws(
      () => formatFrom("MonitoRSS Alerts", "alerts"),
      /BACKEND_API_SMTP_FROM/,
    );
  });
});
