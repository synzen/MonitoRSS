export interface PaddleSubscriptionPreviewResponse {
  data: {
    immediate_transaction: {
      billing_period: {
        starts_at: string;
        ends_at: string;
      };
      details: {
        totals: {
          /**
           * Subtotal before discount, tax, and deductions. If an item, unit price multiplied by quantity.
           */
          subtotal: string;
          /**
           * Total tax on the subtotal.
           */
          tax: string;
          /**
           * Total after discount and tax, before credits
           */
          total: string;
          /**
           * Total credit applied to this transaction.
           * This includes credits applied using a customer's credit balance and adjustments to a billed transaction.
           */
          credit: string;
          /**
           * Total due on a transaction after credits but before any payments.
           * Q: What is "payments"?
           */
          grand_total: string;
          /**
           * Total due on a transaction after credits and any payments.
           * This is likely irrelevant for subscription previews
           * https://developer.paddle.com/changelog/2023/transaction-totals-grand-total
           */
          balance: string;
        };
      };
    } | null;
  };
}
