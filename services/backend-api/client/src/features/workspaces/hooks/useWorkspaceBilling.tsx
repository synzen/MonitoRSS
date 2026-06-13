import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ApiAdapterError from "@/utils/ApiAdapterError";
import {
  cancelWorkspaceBilling,
  convertWorkspaceBilling,
  getWorkspaceUpdatePaymentMethodTransaction,
  previewWorkspaceBillingChange,
  resumeWorkspaceBilling,
  updateWorkspaceBilling,
  type WorkspaceBillingChangePreviewOutput,
  type WorkspaceUpdatePaymentMethodOutput,
} from "../api/workspaceBilling";

// All billing mutations invalidate the workspace detail query: the webhook has
// already reflected the change onto the workspace record by the time the
// endpoint returns (the server polls for it).
const useInvalidateWorkspace = () => {
  const queryClient = useQueryClient();

  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
  };
};

export const useUpdateWorkspaceBilling = () => {
  const invalidate = useInvalidateWorkspace();

  return useMutation<
    void,
    ApiAdapterError,
    { workspaceSlug: string; prices: Array<{ priceId: string; quantity: number }> }
  >((input) => updateWorkspaceBilling(input), {
    onSuccess: invalidate,
  });
};

export const useCancelWorkspaceBilling = () => {
  const invalidate = useInvalidateWorkspace();

  return useMutation<void, ApiAdapterError, { workspaceSlug: string }>(
    ({ workspaceSlug }) => cancelWorkspaceBilling(workspaceSlug),
    {
      onSuccess: invalidate,
    },
  );
};

export const useResumeWorkspaceBilling = () => {
  const invalidate = useInvalidateWorkspace();

  return useMutation<void, ApiAdapterError, { workspaceSlug: string }>(
    ({ workspaceSlug }) => resumeWorkspaceBilling(workspaceSlug),
    {
      onSuccess: invalidate,
    },
  );
};

export const useConvertWorkspaceBilling = () => {
  const invalidate = useInvalidateWorkspace();

  return useMutation<void, ApiAdapterError, { workspaceSlug: string; feedIds: string[] }>(
    (input) => convertWorkspaceBilling(input),
    {
      onSuccess: invalidate,
    },
  );
};

// Lazily fetched on the owner's click: minting a Paddle transaction has a
// side effect, so it must not run on render. The caller invokes refetch(),
// then opens the Paddle overlay with the returned transaction id.
export const useWorkspaceUpdatePaymentMethodTransaction = (workspaceSlug: string) => {
  const { error, fetchStatus, refetch } = useQuery<
    WorkspaceUpdatePaymentMethodOutput,
    ApiAdapterError
  >(
    ["workspace-update-payment-method-transaction", workspaceSlug],
    async () => getWorkspaceUpdatePaymentMethodTransaction(workspaceSlug),
    {
      cacheTime: 0,
      enabled: false,
    },
  );

  return { error, fetchStatus, refetch };
};

export const useWorkspaceBillingChangePreview = ({
  workspaceSlug,
  prices,
  enabled,
}: {
  workspaceSlug?: string;
  prices?: Array<{ priceId: string; quantity: number }>;
  enabled?: boolean;
}) => {
  const { data, status, error } = useQuery<
    WorkspaceBillingChangePreviewOutput,
    ApiAdapterError | Error
  >(
    ["workspace-billing-preview", { workspaceSlug, prices }],
    async () => {
      if (!workspaceSlug || !prices?.length) {
        throw new Error("Missing workspace billing preview input");
      }

      return previewWorkspaceBillingChange({ workspaceSlug, prices });
    },
    {
      enabled: !!enabled && !!workspaceSlug && !!prices?.length,
    },
  );

  return {
    preview: data?.data,
    status,
    error,
  };
};
