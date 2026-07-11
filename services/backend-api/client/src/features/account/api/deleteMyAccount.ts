import fetchRest from "@/utils/fetchRest";

export interface DeleteMyAccountInput {
  details: {
    code: string;
  };
}

export const deleteMyAccount = async ({ details }: DeleteMyAccountInput): Promise<void> => {
  await fetchRest("/api/v1/account/@me", {
    requestOptions: {
      method: "DELETE",
      body: JSON.stringify(details),
    },
    skipJsonParse: true,
  });
};
