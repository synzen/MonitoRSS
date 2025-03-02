import { chakra, Box, Checkbox, Stack } from "@chakra-ui/react";
import { FeedConnectionType } from "../../../../types";
import { UserFeed } from "../../../feed/types";
import { getPrettyConnectionName } from "../../../../utils/getPrettyConnectionName";
import { getPrettyConnectionDetail } from "../../../../utils/getPrettyConnectionDetail";

interface Props {
  feed: UserFeed;
  checkedConnectionIds: string[];
  onCheckConnectionChange: (connectionIdsChecked: string[]) => void;
}

export const ConnectionsCheckboxList = ({
  feed,
  checkedConnectionIds,
  onCheckConnectionChange,
}: Props) => {
  return (
    <Stack as="ul" listStyleType="none" spacing={1}>
      {feed?.connections
        .filter((c) => c.key === FeedConnectionType.DiscordChannel)
        .map((c) => {
          const connectionDetail = getPrettyConnectionDetail(c as never);

          return (
            <Box
              bg="gray.800"
              borderWidth="2px"
              borderColor={checkedConnectionIds.includes(c.id) ? "blue.400" : "transparent"}
              rounded="md"
            >
              <Checkbox
                px={4}
                py={3}
                onChange={(e) => {
                  if (e.target.checked && !checkedConnectionIds.includes(c.id)) {
                    onCheckConnectionChange([...checkedConnectionIds, c.id]);
                  } else if (!e.target.checked && checkedConnectionIds.includes(c.id)) {
                    onCheckConnectionChange(checkedConnectionIds.filter((id) => id !== c.id));
                  }
                }}
                isChecked={checkedConnectionIds.includes(c.id)}
                width="100%"
              >
                <chakra.span ml={4} display="inline-block">
                  <chakra.span color="gray.400" fontSize="sm">
                    {getPrettyConnectionName(c as never)}
                  </chakra.span>
                  {connectionDetail ? (
                    <chakra.span display="block">{connectionDetail}</chakra.span>
                  ) : (
                    <br />
                  )}
                  <chakra.span fontWeight={600}>{c.name}</chakra.span>
                </chakra.span>
              </Checkbox>
            </Box>
          );
        })}
    </Stack>
  );
};
