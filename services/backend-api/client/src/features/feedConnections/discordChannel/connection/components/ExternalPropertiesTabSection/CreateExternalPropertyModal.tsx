import { Box, Button, Code, HStack, Spinner, Stack, Table, Text, chakra } from "@chakra-ui/react";
import { cloneElement, useEffect, useState } from "react";
import { FaArrowsRotate, FaStar } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import {
  SelectArticlePropertyType,
  useUserFeedArticles,
  useUserFeedContext,
} from "@/features/feed";

import { InlineErrorAlert } from "@/components";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { Tag } from "@/components/ui/tag";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

interface Props {
  trigger: React.ReactElement;
  onSubmitted: (data: { sourceField: string }) => void;
}

const CreateExternalPropertyModal = ({ trigger, onSubmitted }: Props) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const {
    data: articlesData,
    error,
    refetch,
    fetchStatus,
    status,
  } = useUserFeedArticles({
    feedId: userFeed.id,
    data: {
      selectPropertyTypes: [SelectArticlePropertyType.Url],
      selectProperties: ["*"],
      limit: 1,
      skip: 0,
      random: true,
      formatOptions: articleFormatOptions,
    },
    disabled: !open,
  });

  // @ts-ignore
  const linkExists = !!articlesData?.result.articles[0]?.link;

  const article = articlesData?.result.articles[0];
  const articleObjectEntries = Object.entries(article ?? {});

  const onClickRandomize = async () => {
    if (fetchStatus === "fetching") {
      return;
    }

    await refetch();
  };

  useEffect(() => {
    if (!open) {
      setSelected("");
    }
  }, [open]);

  useEffect(() => {
    if (open && linkExists && !selected) {
      // setSelected("link");
    }
  }, [linkExists, selected, open]);

  return (
    <>
      {cloneElement(trigger, { onClick: () => setOpen(true) })}
      <DialogRoot
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        size="cover"
        scrollBehavior="inside"
      >
        <DialogContent>
          <DialogHeader marginRight={4}>
            <DialogTitle>Create a new external property</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody tabIndex={-1}>
            <Box srOnly aria-live="polite" aria-busy={status === "loading"}>
              {status === "success" && (
                <span>Finished loading ${articleObjectEntries.length} article properties</span>
              )}
            </Box>
            <Stack gap={4} paddingBottom={4}>
              {error && (
                <InlineErrorAlert
                  title="Failed to get article properties"
                  description={error.message}
                />
              )}
              {status === "loading" && (
                <Stack alignItems="center" width="100%" aria-busy>
                  <Spinner />
                  <Text>Loading article properties...</Text>
                </Stack>
              )}
              {status === "success" && !error && (
                <Stack gap={4}>
                  <Text>
                    Select the source property containing the URL that references the page with the
                    desired content. If you don&apos;t see a property that fits, you can randomize
                    the article to get a new sample by clicking the randomize button. The
                    recommended source property is the link property.
                  </Text>
                  <Box>
                    <SafeLoadingButton
                      loading={fetchStatus === "fetching"}
                      aria-disabled={fetchStatus === "fetching"}
                      onClick={onClickRandomize}
                    >
                      <FaArrowsRotate aria-hidden />
                      <span>Randomize sample article</span>
                    </SafeLoadingButton>
                  </Box>
                  <Box
                    bg="bg.subtle"
                    borderWidth="1px"
                    borderColor="border"
                    p={2}
                    rounded="lg"
                    overflow="auto"
                  >
                    <chakra.fieldset>
                      <chakra.legend srOnly>Source Property</chakra.legend>
                      <RadioGroup
                        onValueChange={(details) => setSelected(details.value ?? "")}
                        value={selected}
                      >
                        <Table.ScrollArea role="presentation">
                          <Table.Root size="sm">
                            <Table.Header>
                              <Table.Row>
                                <Table.ColumnHeader>Article Property</Table.ColumnHeader>
                                <Table.ColumnHeader>Sample Article Value</Table.ColumnHeader>
                              </Table.Row>
                            </Table.Header>
                            <Table.Body>
                              {articleObjectEntries.map(([field, value]) => {
                                if (field === "id" || field === "idHash" || !value) {
                                  return null;
                                }

                                return (
                                  <Table.Row key={field}>
                                    <Table.Cell>
                                      <Radio value={field} mr={2}>
                                        <Code>{field}</Code>
                                        {field === "link" && (
                                          <Tag
                                            ml={3}
                                            colorPalette="green"
                                            size="sm"
                                            startElement={<FaStar aria-hidden />}
                                          >
                                            Recommended source property
                                          </Tag>
                                        )}
                                      </Radio>
                                    </Table.Cell>
                                    <Table.Cell whiteSpace="normal" wordBreak="break-all">
                                      {value}
                                    </Table.Cell>
                                  </Table.Row>
                                );
                              })}
                            </Table.Body>
                          </Table.Root>
                        </Table.ScrollArea>
                      </RadioGroup>
                    </chakra.fieldset>
                  </Box>
                </Stack>
              )}
            </Stack>
          </DialogBody>
          <DialogFooter>
            <HStack>
              <Button onClick={() => setOpen(false)} variant="ghost">
                Cancel
              </Button>
              <PrimaryActionButton
                disabled={!selected}
                aria-disabled={!selected}
                onClick={() => {
                  if (!selected) {
                    return;
                  }

                  onSubmitted({ sourceField: selected });
                  setOpen(false);
                }}
              >
                Create
              </PrimaryActionButton>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default CreateExternalPropertyModal;
