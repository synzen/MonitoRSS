interface PaddleProductPrice {
  id: string;
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
