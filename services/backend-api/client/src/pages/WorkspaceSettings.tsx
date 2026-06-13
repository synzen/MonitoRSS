import { Heading, Stack, StackSeparator, Text } from "@chakra-ui/react";
import { BoxConstrained } from "@/components";
import { PageAlertContextOutlet, PageAlertProvider } from "@/contexts/PageAlertContext";
import {
  useCurrentWorkspace,
  WorkspaceDeleteSection,
  WorkspaceMembers,
  WorkspaceSettings,
} from "@/features/workspaces";

export const WorkspaceSettingsPage = () => {
  const workspace = useCurrentWorkspace();

  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container gap={10} height="100%" paddingTop={8} paddingBottom={24}>
        <PageAlertProvider>
          <PageAlertContextOutlet />
          <Stack gap={10}>
            <Stack gap={1}>
              <Heading as="h1" size="lg">
                Team settings
              </Heading>
              <Text color="fg.muted">
                Manage this team&apos;s profile, integrations, and members.
              </Text>
            </Stack>
            <Stack gap={10} separator={<StackSeparator />}>
              <WorkspaceSettings />
              <WorkspaceMembers />
              {/* Gated here, not just inside the component: the Stack inserts a
              separator before every element child, so a null-rendering child
              would still leave a trailing separator for admins. */}
              {workspace?.myRole === "owner" && <WorkspaceDeleteSection />}
            </Stack>
          </Stack>
        </PageAlertProvider>
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};
