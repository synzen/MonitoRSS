import { Fragment } from "react";
import { Alert, Link, VisuallyHidden, chakra } from "@chakra-ui/react";
import { FaUpRightFromSquare } from "react-icons/fa6";
import { pages } from "@/constants";
import { DiscordUsername } from "@/features/discordUser";

export interface PersonalFeedSharingInfo {
  sharedSelectedCount: number;
  affectedUserIds: string[];
  anyConnectionScoped: boolean;
}

interface Props {
  sharing: PersonalFeedSharingInfo | null;
  breakingRedditCount: number;
  workspaceSlug: string;
  liveReady: boolean;
}

export const PersonalFeedMoveWarnings = ({
  sharing,
  breakingRedditCount,
  workspaceSlug,
  liveReady,
}: Props) => {
  const sharedSelectedCount = sharing?.sharedSelectedCount ?? 0;
  const sharingLiveMessage =
    sharedSelectedCount > 0
      ? `${
          sharedSelectedCount === 1
            ? "1 feed you are moving is shared with other people."
            : `${sharedSelectedCount} feeds you are moving are shared with other people.`
        } Feed sharing does not move into a workspace. The people who help manage these feeds will lose access until you invite them to the workspace as members.${
          sharing?.anyConnectionScoped
            ? " Some had access to only specific connections; in a workspace they would have access to the whole feed."
            : ""
        }`
      : "";
  const redditLiveMessage =
    breakingRedditCount > 0
      ? `${
          breakingRedditCount === 1
            ? "1 feed you are moving uses your Reddit connection."
            : `${breakingRedditCount} feeds you are moving use your Reddit connection.`
        } Reddit connections do not move into a workspace, so these feeds will pause until you connect Reddit to this workspace.`
      : "";

  return (
    <>
      <VisuallyHidden role="status" aria-live="polite">
        {liveReady ? sharingLiveMessage : ""}
      </VisuallyHidden>
      {sharedSelectedCount > 0 && (
        <Alert.Root status="warning" data-testid="personal-feed-move-sharing-warning">
          <Alert.Indicator aria-hidden />
          <Alert.Content>
            <Alert.Title display="block">
              {sharedSelectedCount === 1
                ? "1 feed you are moving is shared with other people"
                : `${sharedSelectedCount} feeds you are moving are shared with other people`}
            </Alert.Title>
            <Alert.Description display="block">
              Feed sharing does not move into a workspace. The people who help manage these feeds
              will lose access until you invite them to the workspace as members.
              {sharing?.anyConnectionScoped
                ? " Some had access to only specific connections. In a workspace they would have access to the whole feed."
                : ""}
              {sharing?.affectedUserIds.length ? (
                <chakra.span display="block" mt={1}>
                  Affected:{" "}
                  {sharing.affectedUserIds.map((id, index) => (
                    <Fragment key={id}>
                      {index > 0 ? ", " : ""}
                      <DiscordUsername userId={id} />
                    </Fragment>
                  ))}
                </chakra.span>
              ) : null}
            </Alert.Description>
          </Alert.Content>
        </Alert.Root>
      )}
      <VisuallyHidden role="status" aria-live="polite">
        {liveReady ? redditLiveMessage : ""}
      </VisuallyHidden>
      {breakingRedditCount > 0 && (
        <Alert.Root status="warning" data-testid="personal-feed-move-reddit-warning">
          <Alert.Indicator aria-hidden />
          <Alert.Content>
            <Alert.Title display="block">
              {breakingRedditCount === 1
                ? "1 feed you are moving uses your Reddit connection"
                : `${breakingRedditCount} feeds you are moving use your Reddit connection`}
            </Alert.Title>
            <Alert.Description display="block">
              Workspaces use their own Reddit connection, so these feeds will pause until you
              connect Reddit to this workspace. Your personal Reddit connection is not moved.
            </Alert.Description>
            <Link
              href={pages.workspaceSettings(workspaceSlug)}
              target="_blank"
              rel="noopener noreferrer"
              color="text.link"
              fontSize="sm"
              fontWeight="medium"
              display="inline-flex"
              alignItems="center"
              gap={1}
              mt={2}
              aria-label="Connect Reddit to this workspace (opens in a new tab)"
            >
              Connect Reddit to this workspace
              <FaUpRightFromSquare aria-hidden />
            </Link>
          </Alert.Content>
        </Alert.Root>
      )}
    </>
  );
};
