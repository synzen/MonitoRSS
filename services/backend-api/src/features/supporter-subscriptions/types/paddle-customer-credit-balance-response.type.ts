interface PaddleCreditBalance {
  currency_code: string;
  balance: {
    available: string;
    reserved: string;
    used: string;
  };
}

export interface PaddleCustomerCreditBalanceResponse {
  data: Array<PaddleCreditBalance>;
}
