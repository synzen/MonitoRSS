interface PaddleProductPrice {
  id: string;
}

interface PaddleProduct {
  id: string;
  name: string;
  prices: PaddleProductPrice[];
  custom_data?: {
    key?: string;
  };
}

export interface PaddlePricingPreviewResponse {
  data: {
    currency_code: string;
    details: {
      line_items: Array<{
        price: {
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
