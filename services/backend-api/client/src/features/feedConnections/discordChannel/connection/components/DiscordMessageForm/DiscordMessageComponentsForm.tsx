import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  HStack,
  Input,
  Separator,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { motion, type Transition } from "motion/react";
import { v4 } from "uuid";
import { useRef, useState } from "react";

import { DiscordMessageFormData } from "@/types/discord";
import {
  DiscordComponentButtonStyle,
  DiscordComponentType,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "@/types";
import { AnimatedComponent } from "@/components";
import { Alert } from "@/components/ui/alert";
import { useConnection } from "../../hooks";
import { DiscordTextChannelConnectionDialogContent } from "../AddConnectionDialog";

const DiscordMessageComponentRow = ({
  rowIndex,
  onClickDeleteRow,
}: {
  rowIndex: number;
  onClickDeleteRow: () => void;
}) => {
  const {
    control,
    formState: { errors },
    register,
  } = useFormContext<DiscordMessageFormData>();
  const {
    fields: components,
    append: appendButton,
    remove: removeButton,
  } = useFieldArray({
    control,
    name: `componentRows.${rowIndex}.components`,
    keyName: "hookKey",
  });
  const scrollContainer = useRef<HTMLDivElement>(null);

  const rowErrors = errors.componentRows?.[rowIndex];

  return (
    <Stack border="solid 1px" borderColor="border" p={4} rounded="l3" bg="bg.subtle">
      <HStack justifyContent="space-between" flexWrap="wrap">
        <Badge bg="none" p={0}>
          Button Row {rowIndex + 1}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          colorPalette="red"
          onClick={() => {
            onClickDeleteRow();
          }}
        >
          <FaTrash />
          Delete Row
        </Button>
      </HStack>
      <Separator />
      <Flex overflow="auto" ref={scrollContainer}>
        <AnimatedComponent>
          {components
            ?.filter(
              (c) =>
                c.type === DiscordComponentType.Button &&
                c.style === DiscordComponentButtonStyle.Link,
            )
            ?.map((c, componentIndex) => {
              const labelError = rowErrors?.components?.[componentIndex]?.label?.message;
              const urlError = rowErrors?.components?.[componentIndex]?.url?.message;

              return (
                <motion.div
                  key={c.hookKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    overflow: "hidden",
                    minWidth: 400,
                    maxWidth: 400,
                    width: "100%",
                    marginBottom: 8,
                    borderRadius: 6,
                    marginRight: 8,
                  }}
                  exit={{
                    opacity: 0,
                    minWidth: 0,
                    width: 0,
                    marginRight: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{ ease: "linear" } as Transition}
                >
                  <Stack
                    flex={1}
                    px={6}
                    py={4}
                    border="solid 1px"
                    borderColor="border"
                    bg="bg.panel"
                    rounded="l3"
                  >
                    <HStack justifyContent="space-between">
                      <Badge fontSize={11} bg="none" color="fg.muted" p={0}>
                        Button {componentIndex + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        colorPalette="red"
                        size="xs"
                        onClick={() => {
                          removeButton(componentIndex);
                        }}
                      >
                        <FaTrash />
                        Delete Button
                      </Button>
                    </HStack>
                    <Separator />
                    <Field.Root invalid={!!labelError}>
                      <Field.Label fontSize={12}>Label</Field.Label>
                      <Input
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        size="sm"
                        // value={field.value || ""}
                        {...register(
                          `componentRows.${rowIndex}.components.${componentIndex}.label`,
                        )}
                      />
                      {!labelError && (
                        <Field.HelperText fontSize={11}>
                          The text that will be displayed on the button.
                        </Field.HelperText>
                      )}
                      {labelError && <Field.ErrorText fontSize={11}>{labelError}</Field.ErrorText>}
                    </Field.Root>
                    <Field.Root invalid={!!urlError}>
                      <Field.Label fontSize={12}>URL</Field.Label>
                      <Input
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        size="sm"
                        {...register(`componentRows.${rowIndex}.components.${componentIndex}.url`)}
                      />
                      {!urlError && (
                        <Field.HelperText fontSize={11}>
                          The external URL that the button will link to.
                        </Field.HelperText>
                      )}
                      {urlError && <Field.ErrorText fontSize={11}>{urlError}</Field.ErrorText>}
                    </Field.Root>
                  </Stack>
                </motion.div>
              );
            })}
          <Flex alignItems="center">
            <Button
              aria-label="Add button"
              size="sm"
              variant="outline"
              colorPalette="brand"
              onClick={() => {
                appendButton({
                  id: v4(),
                  type: DiscordComponentType.Button,
                  style: DiscordComponentButtonStyle.Link,
                  label: "",
                  url: "",
                });

                setTimeout(() => {
                  scrollContainer.current?.scrollTo({
                    left: scrollContainer.current?.scrollWidth,
                    behavior: "smooth",
                  });
                }, 100);
              }}
            >
              <FaPlus fontSize={12} />
              Add button
            </Button>
          </Flex>
        </AnimatedComponent>
      </Flex>
    </Stack>
  );
};

interface Props {
  feedId?: string;
  connectionId?: string;
}

export const DiscordMessageComponentsForm = ({ connectionId, feedId }: Props) => {
  const { connection } = useConnection({
    feedId,
    connectionId,
  });
  const { control } = useFormContext<DiscordMessageFormData>();
  const {
    fields: rows,
    append,
    remove,
  } = useFieldArray({
    control,
    name: "componentRows",
    keyName: "hookKey",
  });
  const [editIsOpen, setEditIsOpen] = useState(false);

  return (
    <Stack gap={4}>
      <Text>
        Add buttons that contain links. You may add up to 5 rows, with up to 5 buttons in each row.
        Placeholders may be used.
      </Text>
      {connection &&
        connection.key === FeedConnectionType.DiscordChannel &&
        (connection as FeedDiscordChannelConnection).details.webhook &&
        !(connection as FeedDiscordChannelConnection).details.webhook?.isApplicationOwned && (
          <Alert
            status="warning"
            role="none"
            title="Buttons will not be sent to Discord until this connection's webhook is converted to an application-owned webhook!"
          >
            <Stack gap={2}>
              <Text>
                This connection&apos;s webhook is not currently application-owned. To convert it,
                update this connection. Once updated, an application webhook will be automatically
                created and attached to this connection.
              </Text>
              <Box>
                <DiscordTextChannelConnectionDialogContent
                  connection={connection as FeedDiscordChannelConnection}
                  isOpen={editIsOpen}
                  onClose={() => setEditIsOpen(false)}
                />
                <Button onClick={() => setEditIsOpen(true)}>
                  <span>Update webhook connection</span>
                </Button>
              </Box>
            </Stack>
          </Alert>
        )}
      <Stack gap={4}>
        {rows?.map((row, rowIndex) => {
          return (
            <DiscordMessageComponentRow
              key={row.hookKey}
              rowIndex={rowIndex}
              onClickDeleteRow={() => remove(rowIndex)}
            />
          );
        })}
        <Box>
          <Button
            variant="outline"
            colorPalette="brand"
            disabled={rows ? rows.length >= 5 : false}
            onClick={() => {
              append({
                id: v4(),
                components: [
                  {
                    id: v4(),
                    type: DiscordComponentType.Button,
                    style: DiscordComponentButtonStyle.Link,
                    label: "",
                    url: "",
                  },
                ],
              });
            }}
          >
            <FaPlus fontSize={12} />
            Add button row
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};
