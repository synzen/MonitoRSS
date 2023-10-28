import { UserMe } from "@/features/discordUser";

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
    billingPeriod: {
      start: "2021-01-01T00:00:00.000Z",
      end: "2021-02-01T00:00:00.000Z",
    },
    product: {
      key: "tier2",
      name: "Tier 2",
    },
    status: "ACTIVE",
    billingInterval: "month",
    cancellationDate: null,
    nextBillDate: "2021-02-01T00:00:00.000Z",
  },
};

export default mockUserMe;
