import {
  Box,
  Button,
  Code,
  Flex,
  HStack,
  Icon,
  Link,
  Skeleton,
  Stack,
  Table,
  Text,
  chakra,
} from "@chakra-ui/react";
import { cloneElement, useEffect, useState } from "react";
import { FaUpRightFromSquare, FaArrowsRotate } from "react-icons/fa6";
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
import { Tooltip } from "@/components/ui/tooltip";
import { Radio, RadioGroup } from "@/components/ui/radio";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";

interface Props {
  defaultValue: string;
  trigger: React.ReactElement;
  onSubmitted: (data: { sourceField: string }) => void;
}

const UpdateExternalPropertyModal = ({ trigger, onSubmitted, defaultValue }: Props) => {
  const { userFeed, articleFormatOptions } = useUserFeedContext();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState("");
  const {
    data: articlesData,
    error,
    refetch,
    fetchStatus,
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
  });

  const article = articlesData?.result.articles[0];
  const articleObjectEntries = Object.entries(article ?? {});

  const onClickRandomize = async () => {
    await refetch();
  };

  useEffect(() => {
    if (!open) {
      setSelected("");
    }
  }, [open]);

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
          <DialogHeader>
            <DialogTitle>Update source property</DialogTitle>
          </DialogHeader>
          <DialogCloseTrigger />
          <DialogBody tabIndex={-1}>
            <Stack gap={4} paddingBottom={4}>
              <Text>
                Select the source property that contains the URL that references the page with the
                desired content.
              </Text>
              {error && (
                <InlineErrorAlert
                  title="Failed to get article properties"
                  description={error.message}
                />
              )}
              {!error && (
                <Box bg="bg.subtle" borderWidth="1px" borderColor="border" p={2} rounded="lg">
                  <RadioGroup
                    onValueChange={(details) => setSelected(details.value ?? "")}
                    value={selected || defaultValue}
                  >
                    <Table.ScrollArea overflow="auto">
                      <Table.Root size="sm">
                        <Table.Header>
                          <Table.Row>
                            <Table.ColumnHeader />
                            <Table.ColumnHeader>Article Property</Table.ColumnHeader>
                            <Table.ColumnHeader>
                              <span>Sample Article Value</span>
                              <Tooltip content="See another random article's values">
                                <SafeLoadingButton
                                  size="xs"
                                  ml={2}
                                  loading={fetchStatus === "fetching"}
                                  onClick={onClickRandomize}
                                  variant="outline"
                                  aria-label="See another random article's values"
                                >
                                  <Icon as={FaArrowsRotate} />
                                  <span>Randomize sample article</span>
                                </SafeLoadingButton>
                              </Tooltip>
                            </Table.ColumnHeader>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {articleObjectEntries.map(([field, value]) => {
                            if (field === "id" || field === "idHash" || !value) {
                              return null;
                            }

                            return (
                              <Table.Row key={field}>
                                <Table.Cell width="min-content">
                                  <Radio
                                    value={field}
                                    id={`field-${field}`}
                                    inputProps={{ name: "field" }}
                                    disabled={fetchStatus !== "idle"}
                                  />
                                </Table.Cell>
                                <Table.Cell>
                                  <Skeleton loading={fetchStatus !== "idle"}>
                                    <chakra.label htmlFor={`field-${field}`}>
                                      <Code>{field}</Code>
                                    </chakra.label>
                                  </Skeleton>
                                </Table.Cell>
                                <Table.Cell whiteSpace="nowrap">
                                  <Skeleton loading={fetchStatus !== "idle"}>
                                    <Flex asChild alignItems="center" gap={2}>
                                      <chakra.label htmlFor={`field-${field}`}>
                                        {value}
                                        <Link
                                          color="text.link"
                                          href={value}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <Icon as={FaUpRightFromSquare} />
                                        </Link>
                                      </chakra.label>
                                    </Flex>
                                  </Skeleton>
                                </Table.Cell>
                              </Table.Row>
                            );
                          })}
                        </Table.Body>
                      </Table.Root>
                    </Table.ScrollArea>
                  </RadioGroup>
                </Box>
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
                onClick={() => {
                  onSubmitted({ sourceField: selected });
                  setOpen(false);
                }}
              >
                Update
              </PrimaryActionButton>
            </HStack>
          </DialogFooter>
        </DialogContent>
      </DialogRoot>
    </>
  );
};

export default UpdateExternalPropertyModal;
