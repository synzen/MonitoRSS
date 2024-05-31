import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Input,
  Stack,
  Text,
} from "@chakra-ui/react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { AddIcon } from "@chakra-ui/icons";
import { motion } from "framer-motion";
import { v4 } from "uuid";
import { useRef } from "react";
import { DiscordMessageFormData } from "@/types/discord";
import {
  DiscordComponentButtonStyle,
  DiscordComponentType,
  FeedConnectionType,
  FeedDiscordChannelConnection,
} from "../../../../types";
import { AnimatedComponent } from "../../../../components";
import { useConnection } from "../../hooks";
import { EditDiscordChannelWebhookConnectionButton } from "../EditDiscordChannelWebhookConnectionButton";

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
    <Stack border="solid 1px" borderColor="gray.700" p={4} rounded="md" bg="gray.900">
      <HStack justifyContent="space-between" flexWrap="wrap">
        <Badge bg="none" p={0}>
          Row {rowIndex + 1}
        </Badge>
        <Button
          size="sm"
          variant="ghost"
          colorScheme="red"
          onClick={() => {
            onClickDeleteRow();
          }}
        >
          Delete
        </Button>
      </HStack>
      <Divider />
      <Flex overflow="auto" ref={scrollContainer}>
        <AnimatedComponent>
          {components
            ?.filter(
              (c) =>
                c.type === DiscordComponentType.Button &&
                c.style === DiscordComponentButtonStyle.Link
            )
            ?.map((c, componentIndex) => {
              const labelError = rowErrors?.components?.[componentIndex]?.label?.message;
              const urlError = rowErrors?.components?.[componentIndex]?.url?.message;

              return (
                <HStack
                  as={motion.div}
                  key={c.hookKey}
                  alignItems="center"
                  overflow="hidden"
                  minW={400}
                  maxW={400}
                  width="100%"
                  mb={2}
                  rounded="md"
                  mr={2}
                  exit={{
                    opacity: 0,
                    minWidth: 0,
                    width: 0,
                    marginRight: 0,
                  }}
                  animate={{
                    opacity: 1,
                  }}
                  transition={{
                    type: "linear",
                  }}
                >
                  <Stack
                    flex={1}
                    px={6}
                    py={4}
                    border="solid 1px"
                    borderColor="gray.800"
                    bg="gray.700"
                    rounded="md"
                  >
                    <HStack justifyContent="space-between">
                      <Badge fontSize={11} bg="none" color="whiteAlpha.700" p={0}>
                        Button {componentIndex + 1}
                      </Badge>
                      <Button
                        variant="ghost"
                        colorScheme="red"
                        size="xs"
                        onClick={() => {
                          removeButton(componentIndex);
                        }}
                      >
                        Delete
                      </Button>
                    </HStack>
                    <Divider />
                    <FormControl isInvalid={!!labelError}>
                      <FormLabel fontSize={12}>Label</FormLabel>
                      <Input
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        bg="gray.800"
                        size="sm"
                        // value={field.value || ""}
                        {...register(
                          `componentRows.${rowIndex}.components.${componentIndex}.label`
                        )}
                      />
                      {!labelError && (
                        <FormHelperText
                          fontSize={11}
                          as={motion.div}
                          exit={{ whiteSpace: "nowrap" }}
                        >
                          The text that will be displayed on the button.
                        </FormHelperText>
                      )}
                      {labelError && (
                        <FormErrorMessage
                          as={motion.div}
                          exit={{ whiteSpace: "nowrap" }}
                          fontSize={11}
                        >
                          {labelError}
                        </FormErrorMessage>
                      )}
                    </FormControl>
                    <FormControl isInvalid={!!urlError}>
                      <FormLabel fontSize={12}>URL</FormLabel>
                      <Input
                        autoCapitalize="off"
                        autoComplete="off"
                        autoCorrect="off"
                        bg="gray.800"
                        size="sm"
                        {...register(`componentRows.${rowIndex}.components.${componentIndex}.url`)}
                      />
                      {!urlError && (
                        <FormHelperText
                          as={motion.div}
                          exit={{ whiteSpace: "nowrap" }}
                          fontSize={11}
                        >
                          The external URL that the button will link to.
                        </FormHelperText>
                      )}
                      {urlError && (
                        <FormErrorMessage
                          as={motion.div}
                          exit={{ whiteSpace: "nowrap" }}
                          fontSize={11}
                        >
                          {urlError}
                        </FormErrorMessage>
                      )}
                    </FormControl>
                  </Stack>
                </HStack>
              );
            })}
          <Flex alignItems="center">
            <Button
              leftIcon={<AddIcon fontSize={12} />}
              aria-label="Add button"
              size="sm"
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
  // const [rows] = watch(["componentRows"]);

  return (
    <Stack spacing={4}>
      <Text>
        Add buttons that contain links. You may add up to 5 rows, with up to 5 buttons in each row.
        Placeholders may be used.
      </Text>
      {connection &&
        connection.key === FeedConnectionType.DiscordChannel &&
        (connection as FeedDiscordChannelConnection).details.webhook &&
        !(connection as FeedDiscordChannelConnection).details.webhook?.isApplicationOwned && (
          <Alert status="warning">
            <AlertIcon />
            <Box>
              <AlertTitle>
                Buttons will not be sent to Discord until this connection&apos;s webhook is
                converted to an application-owned webhook!
              </AlertTitle>
              <AlertDescription>
                <Stack spacing={2}>
                  <Text>
                    This connection&apos;s webhook is not currently application-owned. To convert
                    it, update this connection. Once updated, an application webhook will be
                    automatically created and attached to this connection.
                  </Text>
                  <Box>
                    <EditDiscordChannelWebhookConnectionButton
                      feedId={feedId as string}
                      connection={connection as FeedDiscordChannelConnection}
                    />
                  </Box>
                </Stack>
              </AlertDescription>
            </Box>
          </Alert>
        )}
      <Stack spacing={4}>
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
            leftIcon={<AddIcon fontSize={12} />}
            isDisabled={rows ? rows.length >= 5 : false}
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
            Add row
          </Button>
        </Box>
      </Stack>
    </Stack>
  );
};
