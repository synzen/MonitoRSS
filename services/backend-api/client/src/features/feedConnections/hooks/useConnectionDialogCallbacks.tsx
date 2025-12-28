import { useCallback } from "react";
import { usePageAlertContext } from "../../../contexts/PageAlertContext";

export interface UseConnectionDialogCallbacksResult {
  onSaveSuccess: (connectionName: string | undefined) => void;
}

export const useConnectionDialogCallbacks = (): UseConnectionDialogCallbacksResult => {
  const { createSuccessAlert } = usePageAlertContext();

  const onSaveSuccess = useCallback(
    (connectionName: string | undefined) => {
      createSuccessAlert({
        title: "You're all set!",
        description: `New articles will be delivered automatically to ${
          connectionName || "your channel"
        }.`,
      });
    },
    [createSuccessAlert]
  );

  return {
    onSaveSuccess,
  };
};
