interface PaddleProductPrice {
  id: string;
  status: "active" | "archived";
  billing_cycle: {
    frequency: number;
    interval: "day" | "week" | "month" | "year";
  } | null;
  custom_data?: {
    key?: string;
  } | null;
}

export interface PaddleProduct {
  id: string;
  name: string;
  prices: PaddleProductPrice[];
  custom_data?: {
    key?: string;
  };
}

export interface PaddleProductsResponse {
  data: Array<PaddleProduct>;
}

export interface PaddleProductResponse {
  data: PaddleProduct;
}
