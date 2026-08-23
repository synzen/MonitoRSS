import { Box, Button, chakra, HStack, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { type ButtonHTMLAttributes, useEffect, useMemo, useRef, useState } from "react";
import Select, {
  type FormatOptionLabelMeta,
  type GroupBase,
  type MultiValueGenericProps,
  type MultiValueRemoveProps,
  type SelectInstance,
  type StylesConfig,
} from "react-select";
import { FaPlus, FaXmark } from "react-icons/fa6";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { Panel } from "@/components/Panel";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { Field } from "@/components/ui/field";
import { RadioCardItem, RadioCardRoot } from "@/components/ui/radio-card";
import { REACT_SELECT_STYLES } from "@/constants/reactSelectStyles";
import { useCreateWorkspaceTag, useWorkspaceTags } from "../hooks";
import { WORKSPACE_TAG_COLORS, type WorkspaceTag, type WorkspaceTagColor } from "../types";
import { WORKSPACE_TAG_PALETTE, WorkspaceTagChip } from "./WorkspaceTagList";

const MAX_FEED_TAGS = 10;

interface TagOption {
  value: string;
  label: string;
  tag?: WorkspaceTag;
}

interface Props {
  workspaceSlug: string;
  selectedTagIds: string[];
  selectedTags?: WorkspaceTag[];
  onChange: (tagIds: string[]) => void;
}

const TagMultiValueRemove = (
  props: MultiValueRemoveProps<TagOption, true, GroupBase<TagOption>>,
) => {
  const { data, innerProps } = props;
  const buttonProps = innerProps as unknown as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <chakra.button
      type="button"
      {...buttonProps}
      aria-label={`Remove ${data.label}`}
      display="flex"
      alignItems="center"
      justifyContent="center"
      minWidth="24px"
      minHeight="24px"
      color="inherit"
      borderRadius="sm"
      _hover={{ background: "bg.panel" }}
      _focusVisible={{ outline: "2px solid", outlineColor: "brand.focusRing" }}
    >
      <FaXmark aria-hidden />
    </chakra.button>
  );
};

const TagMultiValueContainer = (
  props: MultiValueGenericProps<TagOption, true, GroupBase<TagOption>>,
) => {
  const { data, innerProps, children } = props;
  const tag = data.tag as WorkspaceTag | undefined;
  const palette = WORKSPACE_TAG_PALETTE[tag?.color ?? "gray"];

  return (
    <Box
      {...innerProps}
      data-testid="workspace-tag-selected-chip"
      display="inline-flex"
      alignItems="center"
      maxWidth="100%"
      minHeight="28px"
      m="2px"
      background={palette.background}
      color={palette.text}
      borderWidth="1px"
      borderColor={palette.border}
      borderRadius="md"
      fontSize="sm"
      fontWeight="semibold"
      overflow="hidden"
    >
      {children}
    </Box>
  );
};

const formatTagOptionLabel = (option: TagOption, { context }: FormatOptionLabelMeta<TagOption>) => {
  if (!option.tag) {
    return option.label;
  }

  if (context === "value") {
    return option.label;
  }

  const palette = WORKSPACE_TAG_PALETTE[option.tag.color ?? "gray"];

  return (
    <HStack gap={2}>
      <Box
        aria-hidden="true"
        width="14px"
        height="14px"
        borderRadius="full"
        background={palette.background}
        borderWidth="1px"
        borderColor={palette.border}
      />
      <Text fontSize="md">{option.label}</Text>
    </HStack>
  );
};

const getTagColorLabel = (color: WorkspaceTagColor) =>
  color === "gray" ? "Neutral" : color[0].toUpperCase() + color.slice(1);

const HiddenIndicatorSeparator = () => null;

const createSelectStyles = (): StylesConfig<TagOption, true, GroupBase<TagOption>> => {
  const baseStyles = REACT_SELECT_STYLES() as unknown as StylesConfig<
    TagOption,
    true,
    GroupBase<TagOption>
  >;
  const baseControl = baseStyles.control;

  return {
    ...baseStyles,
    control: (provided, state) => ({
      ...(baseControl ? baseControl(provided, state) : provided),
      height: "auto",
      minHeight: "44px",
    }),
    input: (provided) => ({
      ...provided,
      color: "var(--app-fg)",
      fontSize: "1rem",
    }),
    option: (provided, state) => {
      let background = "var(--app-bg-panel)";

      if (state.isSelected) {
        background = "var(--app-accent-solid)";
      } else if (state.isFocused) {
        background = "var(--app-bg-emphasized)";
      }

      return {
        ...provided,
        color: "var(--app-fg)",
        background,
        fontSize: "1rem",
      };
    },
    placeholder: (provided) => ({
      ...provided,
      color: "var(--app-fg-muted)",
      fontSize: "1rem",
    }),
    noOptionsMessage: (provided) => ({
      ...provided,
      color: "var(--app-fg-muted)",
      fontSize: "1rem",
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: "inherit",
      fontSize: "0.875rem",
      padding: "2px 6px 2px 8px",
    }),
  };
};

export const WorkspaceTagSelector = ({
  workspaceSlug,
  selectedTagIds,
  selectedTags = [],
  onChange,
}: Props) => {
  const { data, status, error: listError, refetch: refetchTags } = useWorkspaceTags(workspaceSlug);
  const {
    mutateAsync: createTag,
    status: createStatus,
    error: createError,
    reset: resetCreateTag,
  } = useCreateWorkspaceTag(workspaceSlug);
  const [isCreating, setIsCreating] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState<WorkspaceTagColor>("gray");
  const newTagInputRef = useRef<HTMLInputElement>(null);
  const newTagButtonRef = useRef<HTMLButtonElement>(null);
  const tagSelectRef = useRef<SelectInstance<TagOption, true, GroupBase<TagOption>>>(null);
  const restoreFocusTargetRef = useRef<"new-tag" | "tags" | null>(null);
  const tags = useMemo(() => {
    const byId = new Map(selectedTags.map((tag) => [tag.id, tag]));

    for (const tag of data?.results ?? []) {
      byId.set(tag.id, tag);
    }

    return [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  }, [data?.results, selectedTags]);
  const options = useMemo<TagOption[]>(
    () => tags.map((tag) => ({ value: tag.id, label: tag.name, tag })),
    [tags],
  );
  const selectedOptions = selectedTagIds
    .map((id) => options.find((option) => option.value === id))
    .filter((option): option is TagOption => !!option);
  const atLimit = selectedTagIds.length >= MAX_FEED_TAGS;
  const trimmedNewTagName = newTagName.trim();
  const duplicateTag = tags.some(
    (tag) =>
      tag.name.localeCompare(trimmedNewTagName, undefined, {
        sensitivity: "base",
      }) === 0,
  );
  const suggestedName = searchText.trim();
  const suggestedNameExists = tags.some(
    (tag) =>
      tag.name.localeCompare(suggestedName, undefined, {
        sensitivity: "base",
      }) === 0,
  );
  const styles = useMemo(createSelectStyles, []);

  useEffect(() => {
    if (isCreating) {
      newTagInputRef.current?.focus();

      return;
    }

    const target = restoreFocusTargetRef.current;

    if (!target) {
      return;
    }

    restoreFocusTargetRef.current = null;

    if (target === "new-tag" && !atLimit) {
      newTagButtonRef.current?.focus();
    } else {
      tagSelectRef.current?.focus();
    }
  }, [atLimit, isCreating]);

  const closeCreatePanel = (focusTarget: "new-tag" | "tags") => {
    restoreFocusTargetRef.current = focusTarget;
    setIsCreating(false);
    setNewTagName("");
    setNewTagColor("gray");
    resetCreateTag();
  };

  const beginCreating = () => {
    setNewTagName(suggestedName && !suggestedNameExists ? suggestedName : "");
    setNewTagColor("gray");
    resetCreateTag();
    setIsCreating(true);
  };

  const handleCreate = async () => {
    if (!trimmedNewTagName || duplicateTag || atLimit) {
      return;
    }

    try {
      const response = await createTag({
        workspaceSlug,
        data: { name: trimmedNewTagName, color: newTagColor },
      });
      onChange([...selectedTagIds, response.result.id]);
      setSearchText("");
      closeCreatePanel(selectedTagIds.length + 1 >= MAX_FEED_TAGS ? "tags" : "new-tag");
    } catch {}
  };

  return (
    <Stack gap={3}>
      <Box>
        <HStack justifyContent="space-between" alignItems="center" mb={1.5}>
          <chakra.label htmlFor="workspace-feed-tags" fontSize="sm" fontWeight="medium">
            Tags
          </chakra.label>
          {!isCreating && (
            <Button
              ref={newTagButtonRef}
              type="button"
              size="sm"
              variant="ghost"
              colorPalette="brand"
              disabled={atLimit}
              onClick={beginCreating}
            >
              <FaPlus aria-hidden />
              New tag
            </Button>
          )}
        </HStack>
        <Select<TagOption, true>
          ref={tagSelectRef}
          inputId="workspace-feed-tags"
          aria-label="Tags"
          isMulti
          isClearable={false}
          isLoading={status === "loading"}
          options={options}
          value={selectedOptions}
          styles={styles}
          menuPosition="fixed"
          placeholder="Search tags…"
          noOptionsMessage={() =>
            atLimit ? "Remove a tag before adding another." : "No tags found."
          }
          components={{
            IndicatorSeparator: HiddenIndicatorSeparator,
            MultiValueContainer: TagMultiValueContainer,
            MultiValueRemove: TagMultiValueRemove,
          }}
          isOptionDisabled={(option) => atLimit && !selectedTagIds.includes(option.value)}
          formatOptionLabel={formatTagOptionLabel}
          onInputChange={(value, action) => {
            if (action.action === "input-change") {
              setSearchText(value);
            }
          }}
          onChange={(next) => {
            setSearchText("");
            onChange(next.map((option) => option.value));
          }}
        />
        <Text color="fg.muted" fontSize="sm" mt={1.5}>
          {atLimit
            ? "You’ve added the maximum of 10 tags. Remove one to add another."
            : "Tags help your Team organize related feeds. Add up to 10."}
        </Text>
      </Box>
      {isCreating && (
        <Panel
          surface="transparent"
          width="full"
          p={4}
          role="group"
          aria-labelledby="create-workspace-tag-heading"
        >
          <Stack gap={4}>
            <Box>
              <Text id="create-workspace-tag-heading" fontSize="md" fontWeight="semibold">
                Create tag
              </Text>
              <Text color="fg.muted" fontSize="sm">
                Create a tag your Team can reuse on other feeds.
              </Text>
            </Box>
            <Field
              label="Tag name"
              invalid={duplicateTag}
              errorText={
                duplicateTag ? (
                  <Text fontSize="sm">A tag with this name already exists.</Text>
                ) : undefined
              }
            >
              <Input
                ref={newTagInputRef}
                value={newTagName}
                maxLength={80}
                fontSize="md"
                onChange={(event) => setNewTagName(event.target.value)}
              />
            </Field>
            <Box as="fieldset">
              <Text as="legend" fontSize="sm" fontWeight="medium" mb={2}>
                Color
              </Text>
              <RadioCardRoot
                value={newTagColor}
                colorPalette="brand"
                size="sm"
                aria-label="Tag color"
                onValueChange={(details) =>
                  setNewTagColor((details.value ?? "gray") as WorkspaceTagColor)
                }
              >
                <SimpleGrid columns={{ base: 2, sm: 3 }} gap={2}>
                  {WORKSPACE_TAG_COLORS.map((color) => {
                    const palette = WORKSPACE_TAG_PALETTE[color];
                    const label = getTagColorLabel(color);

                    return (
                      <RadioCardItem
                        key={color}
                        value={color}
                        minHeight="44px"
                        _focusWithin={{
                          outline: "2px solid",
                          outlineColor: "brand.focusRing",
                          outlineOffset: "2px",
                        }}
                        inputProps={{ "aria-label": label }}
                        indicatorPlacement="start"
                        label={
                          <HStack gap={2}>
                            <Box
                              aria-hidden="true"
                              width="16px"
                              height="16px"
                              borderRadius="full"
                              background={palette.background}
                              borderWidth="1px"
                              borderColor={palette.border}
                            />
                            <Text fontSize="sm">{label}</Text>
                          </HStack>
                        }
                      />
                    );
                  })}
                </SimpleGrid>
              </RadioCardRoot>
            </Box>
            <HStack gap={3}>
              <Text color="fg.muted" fontSize="sm">
                Preview
              </Text>
              <WorkspaceTagChip
                tag={{
                  id: "workspace-tag-preview",
                  name: trimmedNewTagName || "New tag",
                  color: newTagColor,
                }}
              />
            </HStack>
            {createError && (
              <InlineErrorAlert
                title="Couldn’t create tag"
                description={<Text>{createError.message}</Text>}
              />
            )}
            <HStack justifyContent="flex-end" gap={2}>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => closeCreatePanel(atLimit ? "tags" : "new-tag")}
              >
                Cancel
              </Button>
              <PrimaryActionButton
                type="button"
                size="sm"
                loading={createStatus === "loading"}
                loadingText="Creating…"
                disabled={!trimmedNewTagName || duplicateTag || atLimit}
                onClick={handleCreate}
              >
                Create and add
              </PrimaryActionButton>
            </HStack>
          </Stack>
        </Panel>
      )}
      {listError && (
        <InlineErrorAlert
          title="Couldn’t load tags"
          description={
            <Stack alignItems="start">
              <Text>{listError.message}</Text>
              <Button size="sm" onClick={() => refetchTags()}>
                Retry loading tags
              </Button>
            </Stack>
          }
        />
      )}
    </Stack>
  );
};
