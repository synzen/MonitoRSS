import logger from "../../infra/logger";

const formattersByCurrency: Record<string, (input: string) => string> = {
  AUD: (input) => `$${input}`,
  BRL: (input) => `R$${input}`,
  GBP: (input) => `£${input}`,
  CAD: (input) => `CA$${input}`,
  CZK: (input) => `${input} Kč`,
  DKK: (input) => `${input} kr.`,
  EUR: (input) => `€${input}`,
  HKD: (input) => `HK$${input}`,
  HUF: (input) => `${input} Ft`,
  KRW: (input) => `₩${input}`,
  MXN: (input) => `$${input}`,
  NZD: (input) => `NZ$${input}`,
  NOK: (input) => `${input} kr`,
  PLN: (input) => `${input} zł`,
  SGD: (input) => `S$${input}`,
  SEK: (input) => `${input} kr`,
  USD: (input) => `$${input}`,
  JPY: (input) => `¥${input}`,
  TWD: (input) => `NT$${input}`,
  VND: (input) => `${input} ₫`,
  CHF: (input) => `CHF ${input}`,
  INR: (input) => `₹${input}`,
};

// Currencies Paddle bills in whole units (no minor unit), so the amount must
// not be split into a two-digit fractional part.
const ZERO_DECIMAL_CURRENCIES = ["JPY", "KRW", "HUF", "TWD", "VND"];

export function formatCurrency(input: string, currencyCode: string): string {
  const formatter = formattersByCurrency[currencyCode];

  if (!formatter) {
    logger.error(`No formatter for currency code ${currencyCode}`);
    return `${input} ${currencyCode}`;
  }

  const isNegative = input.startsWith("-");
  const sign = isNegative ? "-" : "";
  const magnitude = isNegative ? input.slice(1) : input;

  if (ZERO_DECIMAL_CURRENCIES.includes(currencyCode)) {
    return `${sign}${formatter(magnitude)}`;
  }

  // Paddle sends amounts in minor units (cents). Pad so even sub-dollar amounts
  // keep their two-digit fractional part (e.g. "5" -> "0.05", not "0.50").
  const padded = magnitude.padStart(3, "0");
  const beforeDecimal = padded.slice(0, -2);
  const afterDecimal = padded.slice(-2);

  if (afterDecimal === "00") {
    return `${sign}${formatter(beforeDecimal)}`;
  }

  return `${sign}${formatter(`${beforeDecimal}.${afterDecimal}`)}`;
}
