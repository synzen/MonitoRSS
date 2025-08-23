/* eslint-disable react/jsx-no-useless-fragment */
import { useMemo } from "react";
import {
  SpinnerProps,
  Text,
  TextProps,
  chakra,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Button,
  useDisclosure,
} from "@chakra-ui/react";
import { Loading } from "@/components";
import { useDiscordServerChannels } from "../../hooks";
import { GetDiscordChannelType } from "../../constants";

interface Props {
  serverId?: string;
  channelId: string;
  spinnerSize?: SpinnerProps["size"];
  textProps?: TextProps;
  parenthesis?: boolean;
  hidden?: boolean;
}

export const DiscordChannelName: React.FC<Props> = ({
  serverId,
  channelId,
  spinnerSize,
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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const channelNamesById = useMemo(() => {
    const map = new Map<string, string>();

    if (data?.results) {
      data.results.forEach((channel) => {
        map.set(channel.id, channel.name);
      });
    }

    return map;
  }, [data]);

  if (hidden) {
    return null;
  }

  if (status === "loading") {
    return (
      <span>
        <Loading size={spinnerSize || "sm"} />
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
          variant="link"
          color="orange.500"
          display="inline"
          p={0}
          h="auto"
          fontWeight="inherit"
          fontSize="inherit"
          onClick={onOpen}
        >
          ID: {channelId}
        </Button>
        <Modal isOpen={isOpen} onClose={onClose} size="md">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>Failed to get Discord channel name</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Text>{errorMessage}</Text>
            </ModalBody>
            <ModalFooter>
              <Button colorScheme="blue" onClick={onClose}>
                Close
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </>
    );
  }

  const channelName = channelNamesById.get(channelId) || channelId;

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
