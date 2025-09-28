/* eslint-disable no-restricted-syntax */
export const mockUserFeedArticles = [
  {
    id: "1",
    idHash: "1",
    title: "",
    description:
      "See the 10 best books of 2020, as chosen by the" +
      " editors of The New York Times Book Review.",
  },
  {
    id: "2",
    idHash: "2",
    title: "Meteor Shower Tonight: How to Watch the Geminids",
    description:
      "The Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the yearThe Geminids are one of the most reliable meteor showers of the year",
  },
  {
    id: "3",
    idHash: "3",
    title: "Why is the sky blue? The science behind the color of the sky",
    description: "The sky is blue because of the way light scatters in the atmosphere",
  },
] as Array<Record<string, string> & { id: string; idHash: string }>;

// Load test by adding 400 more properties to each article
for (let i = 4; i <= 400; i += 1) {
  for (const article of mockUserFeedArticles) {
    article[`extraProperty${i}`] = `Extra property ${i}`;
  }
}
