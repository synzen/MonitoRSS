import { FeedConnectionType } from "../types";
import { ConnectionDiscordChannelSettings } from "@/features/feedConnections";

interface Props {
  connectionType: FeedConnectionType;
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled connectionType: ${String(value)}`);
};

/**
 * Thin route shell — dispatches to the destination-specific settings panel.
 * The page is destination-agnostic; the route registration passes `connectionType`
 * based on which URL pattern matched. When destination #2 ships, register a new
 * route pattern + add a new switch case here.
 * See client/docs/adr/004-destination-extensibility.md.
 */
export const ConnectionSettings = ({ connectionType }: Props) => {
  switch (connectionType) {
    case FeedConnectionType.DiscordChannel:
      return <ConnectionDiscordChannelSettings />;
    default:
      return assertNever(connectionType);
  }
};
