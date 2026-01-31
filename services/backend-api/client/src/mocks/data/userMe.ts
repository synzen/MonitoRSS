import { UserMe } from "@/features/discordUser";
import { ProductKey } from "../../constants";

const mockUserMe: UserMe = {
  id: "1",
  email: "email@email.com",
  preferences: {
    alertOnDisabledFeeds: true,
  },
  creditBalance: {
    availableFormatted: "$100",
  },
  subscription: {
    updatedAt: new Date(2020, 1, 1).toISOString(),
    billingPeriod: {
      start: "2021-01-01T00:00:00.000Z",
      end: "2021-02-01T00:00:00.000Z",
    },
    product: {
      key: ProductKey.Tier2,
      name: "Tier 2",
    },
    status: "ACTIVE",
    billingInterval: "month",
    cancellationDate: null,
    nextBillDate: "2021-02-01T00:00:00.000Z",
  },
  enableBilling: true,
  featureFlags: {
    externalProperties: true,
  },
  supporterFeatures: {
    exrternalProperties: {
      enabled: true,
    },
  },
};

export default mockUserMe;
