interface PriceInformation {
  /**
   * Subtotal before discount, tax, and deductions. If an item, unit price multiplied by quantity.
   */
  subtotal: number;
  /**
   * Total tax on the subtotal.
   */
  tax: number;
  /**
   * Total after discount and tax, before credits
   */
  total: number;
  /**
   * Total credit applied to this transaction.
   * This includes credits applied using a customer's credit balance and adjustments to a billed transaction.
   */
  credit: number;
  /**
   * Total due after credits
   */
  balance: number;
}

export interface CheckoutSummaryData {
  currencyCode: string;
  recurringTotals: PriceInformation;
  totals: PriceInformation;
  item: {
    interval: "month" | "year";
    productName: string;
  };
}
