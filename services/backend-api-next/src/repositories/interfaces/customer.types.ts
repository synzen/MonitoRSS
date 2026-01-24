// Customer entity
export interface IDiscordConnectionBenefits {
  maxUserFeeds: number;
}

export interface IDiscordConnection {
  id: string;
  benefits: IDiscordConnectionBenefits;
}

export interface IStripeConnection {
  id: string;
}

export interface ICustomerConnections {
  discord: IDiscordConnection;
  stripe: IStripeConnection;
}

export interface ICustomer {
  id: string;
  connections: ICustomerConnections;
  expireAt?: Date;
}

export interface ICustomerRepository {}
