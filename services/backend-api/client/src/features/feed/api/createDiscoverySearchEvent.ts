import fetchRest from "../../../utils/fetchRest";

export interface CreateDiscoverySearchEventInput {
  searchTerm: string;
  resultCount: number;
}

export const createDiscoverySearchEvent = async (
  input: CreateDiscoverySearchEventInput
): Promise<void> => {
  await fetchRest("/api/v1/discovery-search-events", {
    requestOptions: {
      method: "POST",
      body: JSON.stringify(input),
    },
    skipJsonParse: true,
  });
};
