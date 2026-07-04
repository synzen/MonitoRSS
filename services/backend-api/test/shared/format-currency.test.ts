import { describe, it } from "node:test";
import assert from "node:assert";
import { formatCurrency } from "../../src/shared/utils/format-currency";

describe("formatCurrency", () => {
  it("formats whole-dollar amounts without decimals", () => {
    assert.strictEqual(formatCurrency("1000", "USD"), "$10");
  });

  it("formats amounts with cents", () => {
    assert.strictEqual(formatCurrency("1099", "USD"), "$10.99");
  });

  it("formats sub-dollar amounts with a leading zero", () => {
    assert.strictEqual(formatCurrency("5", "USD"), "$0.05");
    assert.strictEqual(formatCurrency("82", "USD"), "$0.82");
  });

  it("formats zero", () => {
    assert.strictEqual(formatCurrency("0", "USD"), "$0");
  });

  it("renders negative sub-dollar amounts with the sign outside the symbol", () => {
    assert.strictEqual(formatCurrency("-82", "USD"), "-$0.82");
    assert.strictEqual(formatCurrency("-5", "USD"), "-$0.05");
  });

  it("renders negative whole amounts without decimals", () => {
    assert.strictEqual(formatCurrency("-100", "USD"), "-$1");
    assert.strictEqual(formatCurrency("-1099", "USD"), "-$10.99");
  });

  it("places the sign before a suffixed-symbol currency", () => {
    assert.strictEqual(formatCurrency("-82", "EUR"), "-€0.82");
  });

  it("handles zero-decimal currencies", () => {
    assert.strictEqual(formatCurrency("500", "JPY"), "¥500");
    assert.strictEqual(formatCurrency("-500", "JPY"), "-¥500");
  });

  it("treats KRW and HUF as zero-decimal", () => {
    assert.strictEqual(formatCurrency("5000", "KRW"), "₩5000");
    assert.strictEqual(formatCurrency("5000", "HUF"), "5000 Ft");
  });

  it("formats TWD and VND as zero-decimal currencies", () => {
    assert.strictEqual(formatCurrency("500", "TWD"), "NT$500");
    assert.strictEqual(formatCurrency("-500", "TWD"), "-NT$500");
    assert.strictEqual(formatCurrency("25000", "VND"), "25000 ₫");
  });

  it("formats CHF and INR with cents", () => {
    assert.strictEqual(formatCurrency("1099", "CHF"), "CHF 10.99");
    assert.strictEqual(formatCurrency("500", "INR"), "₹5");
    assert.strictEqual(formatCurrency("-82", "INR"), "-₹0.82");
  });
});
