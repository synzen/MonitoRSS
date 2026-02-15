export interface PaddlePricingPreviewResponse {
  data: {
    currency_code: string;
    details: {
      line_items: Array<{
        price: {
          id: string;
          billing_cycle?: {
            frequency: number;
            interval: "month" | "year";
          } | null;
        };
        formatted_totals: {
          total: string;
        };
        product: {
          id: string;
          custom_data?: {
            key?: string;
          } | null;
        };
      }>;
    };
  };
}

export interface PaddleSubscriptionPreviewResponse {
  data: {
    immediate_transaction: {
      billing_period: {
        starts_at: string;
        ends_at: string;
      };
      details: {
        line_items: Array<{
          price_id: string;
          quantity: number;
          totals: {
            subtotal: string;
            tax: string;
            discount: string;
            total: string;
          };
          unit_totals: {
            subtotal: string;
            total: string;
            discount: string;
            tax: string;
          };
          proration: {
            rate: string;
            billing_period: {
              starts_at: string;
              ends_at: string;
            };
          };
          product: {
            id: string;
            name: string;
            custom_data?: {
              key?: string;
            };
          };
        }>;
        totals: {
          subtotal: string;
          tax: string;
          total: string;
          credit: string;
          grand_total: string;
          balance: string;
        };
      };
    } | null;
  };
}

export interface PaddleSubscriptionUpdatePaymentMethodResponse {
  data: {
    id: string;
  };
}
