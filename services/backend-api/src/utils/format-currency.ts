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
  MXN: (input) => `$${input}`,
  NZD: (input) => `NZ$${input}`,
  NOK: (input) => `${input} kr`,
  PLN: (input) => `${input} zł`,
  SGD: (input) => `S$${input}`,
  SEK: (input) => `${input} kr`,
  USD: (input) => `$${input}`,
};

const ZERO_DECIMAL_CURRENCIES = ["JPY"];

/**
 * Cases to consider:
 *
 * "19"
 * "00"
 * "9"
 */

export const formatCurrency = (input: string, currencyCode: string) => {
  const formatter = formattersByCurrency[currencyCode];

  if (!formatter) {
    throw new Error(`No formatter for currency code ${currencyCode}`);
  }

  if (ZERO_DECIMAL_CURRENCIES.includes(currencyCode)) {
    return formatter(input);
  }

  if (input === "0") {
    return formatter("0");
  }

  const decimalIndex = input.length - 2;
  const beforeDecimal = input.slice(0, decimalIndex);
  const afterDecimal = input.slice(decimalIndex);

  if (afterDecimal === "00") {
    return formatter(beforeDecimal);
  }

  return formatter(`${beforeDecimal || "0"}.${afterDecimal.padEnd(2, "0")}`);
};
