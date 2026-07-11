import fetchRest from "@/utils/fetchRest";

export const sendAccountDeletionCode = async (): Promise<void> => {
  await fetchRest("/api/v1/account/@me/deletion-verification", {
    requestOptions: {
      method: "POST",
    },
  });
};
