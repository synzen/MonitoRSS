/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo, useState } from "react";
import { Text, TextProps, chakra, Button, Skeleton } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogCloseTrigger,
  DialogBody,
  DialogFooter,
} from "@/components/ui/dialog";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useDiscordServerChannels, useDiscordServerActiveThreads } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  channelId: string;
  textProps?: TextProps;
  parenthesis?: boolean;
  hidden?: boolean;
}

export const DiscordChannelName: React.FC<Props> = ({
  serverId,
  channelId,
  textProps,
  parenthesis,
  hidden,
}) => {
  const { data, status, error } = useDiscordServerChannels({
    serverId,
    types: [
      GetDiscordChannelType.Forum,
      GetDiscordChannelType.Announcement,
      GetDiscordChannelType.Text,
    ],
  });
  const [open, setOpen] = useState(false);
  const channelNamesById = useMemo(() => {
    const map = new Map<string, string>();

    if (data?.results) {
      data.results.forEach((channel) => {
        map.set(channel.id, channel.name);
      });
    }

    return map;
  }, [data]);

  const channelFound = channelNamesById.has(channelId);

  const { data: threadsData, status: threadsStatus } = useDiscordServerActiveThreads({
    serverId: !channelFound && status === "success" ? serverId : undefined,
  });

  const threadName = useMemo(() => {
    if (!threadsData?.results) {
      return undefined;
    }

    return threadsData.results.find((t) => t.id === channelId)?.name;
  }, [threadsData, channelId]);

  if (hidden) {
    return null;
  }

  const isLoading =
    status === "loading" || (!channelFound && status === "success" && threadsStatus === "loading");

  if (isLoading) {
    return (
      <span>
        <Skeleton height="1em" width="100px" display="inline-block" />
      </span>
    );
  }

  if (error) {
    const errorMessage = `Unable to get channel name${
      error.body?.message ? `: ${error.body.message}` : ""
    } (${error?.message})`;

    return (
      <>
        <Button
          variant="plain"
          textDecoration="underline"
          color="text.warning"
          display="inline"
          p={0}
          h="auto"
          fontWeight="inherit"
          fontSize="inherit"
          onClick={() => setOpen(true)}
        >
          ID: {channelId}
        </Button>
        <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="md">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Failed to get Discord channel name</DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger />
            <DialogBody>
              <Text>{errorMessage}</Text>
            </DialogBody>
            <DialogFooter>
              <PrimaryActionButton onClick={() => setOpen(false)}>Close</PrimaryActionButton>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      </>
    );
  }

  const channelName = channelNamesById.get(channelId) || threadName || channelId;

  const useName = parenthesis ? `(#${channelName})` : `#${channelName}`;

  return (
    <span>
      <chakra.a
        _hover={{
          textDecoration: "underline",
        }}
        href={`https://discord.com/channels/${serverId}/${channelId}`}
        target="_blank"
        rel="noreferrer"
      >
        <chakra.span display="inline" {...textProps}>
          {useName}
        </chakra.span>
      </chakra.a>
    </span>
  );
};
