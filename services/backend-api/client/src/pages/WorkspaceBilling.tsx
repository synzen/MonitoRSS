import { BoxConstrained } from "@/components";
import { PageAlertContextOutlet, PageAlertProvider } from "@/contexts/PageAlertContext";
import { WorkspaceBilling } from "@/features/workspaces";

// Hosts the Paddle overlay checkout directly on the page (never inside a
// modal dialog, which would inert the checkout iframe).
export const WorkspaceBillingPage = () => (
  <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
    <BoxConstrained.Container gap={6} height="100%" paddingTop={8} paddingBottom={24}>
      <PageAlertProvider>
        <PageAlertContextOutlet />
        <WorkspaceBilling />
      </PageAlertProvider>
    </BoxConstrained.Container>
  </BoxConstrained.Wrapper>
);
