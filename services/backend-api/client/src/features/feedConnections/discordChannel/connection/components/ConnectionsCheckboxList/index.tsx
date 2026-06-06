import { chakra, Box, Stack } from "@chakra-ui/react";
import { Checkbox } from "@/components/ui/checkbox";
import { FeedConnectionType } from "@/types";
import { UserFeed } from "@/features/feed";
import { getPrettyConnectionName } from "../../utils/getPrettyConnectionName";
import { getPrettyConnectionDetail } from "../../utils/getPrettyConnectionDetail";

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
    <Stack as="ul" listStyleType="none" gap={1}>
      {feed?.connections
        .filter((c) => c.key === FeedConnectionType.DiscordChannel)
        .map((c) => {
          const connectionDetail = getPrettyConnectionDetail(c as never);

          return (
            <Box
              bg="bg.panel"
              borderWidth="2px"
              borderColor={checkedConnectionIds.includes(c.id) ? "brandSolid" : "transparent"}
              rounded="l3"
            >
              <Checkbox
                px={4}
                py={3}
                onCheckedChange={(e) => {
                  if (e.checked && !checkedConnectionIds.includes(c.id)) {
                    onCheckConnectionChange([...checkedConnectionIds, c.id]);
                  } else if (!e.checked && checkedConnectionIds.includes(c.id)) {
                    onCheckConnectionChange(checkedConnectionIds.filter((id) => id !== c.id));
                  }
                }}
                checked={checkedConnectionIds.includes(c.id)}
                width="100%"
              >
                <chakra.span ml={4} display="inline-block">
                  <chakra.span color="fg.muted" fontSize="sm">
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
