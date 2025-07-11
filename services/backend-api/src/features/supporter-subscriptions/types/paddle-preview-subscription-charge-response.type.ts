export interface PaddlePreviewSubscriptionChargeResponse {
  data: {
    recurring_transaction_details: {
      totals: {
        total: string;
      };
    };
  };
}
