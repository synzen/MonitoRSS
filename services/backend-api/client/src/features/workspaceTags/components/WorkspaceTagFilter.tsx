import { Box, Button, chakra, HStack, Stack, Text } from "@chakra-ui/react";
import { useMemo, type RefObject } from "react";
import { FaChevronDown, FaTags } from "react-icons/fa6";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import {
  MenuCheckboxItem,
  MenuContent,
  MenuRoot,
  MenuTrigger,
} from "@/components/ui/menu";
import type { WorkspaceTag } from "../types";
import { WORKSPACE_TAG_PALETTE } from "./WorkspaceTagList";

export type WorkspaceTagFilterStatus = "idle" | "loading" | "error" | "success";

export interface WorkspaceTagFilterProps {
  tags: WorkspaceTag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  status: WorkspaceTagFilterStatus;
  error?: Error | null;
  onRetry: () => void;
  selectRef?: RefObject<WorkspaceTagFilterFocusTarget>;
}

export interface WorkspaceTagFilterFocusTarget {
  focus: () => void;
}

export const WorkspaceTagFilter = ({
  tags,
  selectedTagIds,
  onChange,
  status,
  error,
  onRetry,
  selectRef,
}: WorkspaceTagFilterProps) => {
  const orderedTags = useMemo(
    () =>
      [...tags].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [tags],
  );
  const selectedTagIdSet = useMemo(
    () => new Set(selectedTagIds),
    [selectedTagIds],
  );
  const selectedCountLabel = selectedTagIds.length
    ? `Tags: ${selectedTagIds.length} selected`
    : "Tags";
  let statusAnnouncement = "";

  if (status === "loading") {
    statusAnnouncement = "Loading Team tags.";
  } else if (status === "error") {
    statusAnnouncement =
      "Team tags could not load. Use Retry loading tags to try again.";
  }

  const handleTagToggle = (tagId: string) => {
    onChange(
      selectedTagIdSet.has(tagId)
        ? selectedTagIds.filter((id) => id !== tagId)
        : [...selectedTagIds, tagId],
    );
  };

  return (
    <Stack gap={1.5} minWidth={0}>
      <MenuRoot closeOnSelect={false}>
        <MenuTrigger asChild>
          <Button
            ref={selectRef as RefObject<HTMLButtonElement>}
            maxWidth={200}
            width="100%"
            aria-label={`Filter feeds by tags: ${selectedTagIds.length} selected`}
            disabled={status === "error"}
            loading={status === "loading"}
          >
            <FaTags />
            <Text
              overflow="hidden"
              textAlign="left"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
            >
              {selectedCountLabel}
            </Text>
            <FaChevronDown />
          </Button>
        </MenuTrigger>
        <MenuContent maxWidth="320px" maxHeight="320px" overflowY="auto">
          {orderedTags.length ? (
            orderedTags.map((tag) => {
              const palette = WORKSPACE_TAG_PALETTE[tag.color ?? "gray"];

              return (
                <MenuCheckboxItem
                  key={tag.id}
                  value={tag.id}
                  checked={selectedTagIdSet.has(tag.id)}
                  onCheckedChange={() => handleTagToggle(tag.id)}
                >
                  <HStack minWidth={0} width="full" gap={2}>
                    <Box
                      aria-hidden="true"
                      flexShrink={0}
                      width="14px"
                      height="14px"
                      borderRadius="full"
                      background={palette.background}
                      borderWidth="1px"
                      borderColor={palette.border}
                    />
                    <Text
                      overflow="hidden"
                      textOverflow="ellipsis"
                      whiteSpace="nowrap"
                    >
                      {tag.name}
                    </Text>
                  </HStack>
                </MenuCheckboxItem>
              );
            })
          ) : (
            <chakra.span display="block" padding={3} color="fg.muted">
              No Team tags yet.
            </chakra.span>
          )}
        </MenuContent>
      </MenuRoot>
      <chakra.span srOnly aria-live="polite">
        {statusAnnouncement}
      </chakra.span>
      {status === "error" && (
        <InlineErrorAlert
          title="Couldn’t load Team tags"
          description={
            <Stack alignItems="start" gap={2}>
              <Text>
                {error?.message || "The tag filter is temporarily unavailable."}
              </Text>
              <Button type="button" size="sm" onClick={onRetry}>
                Retry loading tags
              </Button>
            </Stack>
          }
        />
      )}
    </Stack>
  );
};
