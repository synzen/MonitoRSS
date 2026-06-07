import { Stack } from "@chakra-ui/react";
import { BoxConstrained } from "@/components";
import { PageAlertContextOutlet, PageAlertProvider } from "@/contexts/PageAlertContext";
import { WorkspaceMembers, WorkspaceSettings } from "@/features/workspaces";

export const WorkspaceSettingsPage = () => (
  <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
    <BoxConstrained.Container gap={6} height="100%" paddingTop={6}>
      <PageAlertProvider>
        <PageAlertContextOutlet />
        <Stack gap={12}>
          <WorkspaceSettings />
          <WorkspaceMembers />
        </Stack>
      </PageAlertProvider>
    </BoxConstrained.Container>
  </BoxConstrained.Wrapper>
);
