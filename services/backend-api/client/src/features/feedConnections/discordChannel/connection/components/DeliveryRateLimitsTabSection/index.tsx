import { Box, Button, HStack, Heading, Icon, Stack, Text, chakra } from "@chakra-ui/react";
import { Controller, FormProvider, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { FaPlus, FaTrash } from "react-icons/fa6";
import { useUpdateConnection } from "../../hooks";
import { SavedUnsavedChangesPopupBar } from "@/components";
import {
  DeliveryRateLimitsFormData,
  DeliveryRateLimitsFormSchema,
} from "./constants/DeliveryRateLimitsFormSchema";
import { useUserFeedConnectionContext } from "@/features/feed";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { Field } from "@/components/ui/field";
import { NumberInputRoot, NumberInputField } from "@/components/ui/number-input";

export const DeliveryRateLimitsTabSection = () => {
  const { userFeed, connection } = useUserFeedConnectionContext();
  const { mutateAsync } = useUpdateConnection({ type: connection.key });
  const formMethods = useForm<DeliveryRateLimitsFormData>({
    resolver: yupResolver(DeliveryRateLimitsFormSchema),
    mode: "all",
    defaultValues: {
      rateLimits: connection?.rateLimits || [],
    },
  });
  const {
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = formMethods;
  const { append, remove, fields } = useFieldArray({
    control,
    name: "rateLimits",
    keyName: "hookKey",
  });
  const { createSuccessAlert, createErrorAlert } = usePageAlertContext();
  const currentData = connection?.rateLimits;
  const formFocusRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (currentData) {
      reset({
        rateLimits: currentData || [],
      });
    }
  }, [currentData]);

  const onSubmit = async ({ rateLimits }: DeliveryRateLimitsFormData) => {
    try {
      await mutateAsync({
        connectionId: connection.id,
        feedId: userFeed.id,
        details: {
          rateLimits,
        },
      });
      createSuccessAlert({
        title: "Successfully saved delivery rate limits.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to save delivery rate limits.",
        description: (err as Error).message,
      });
    }
  };

  const onAddRateLimit = () => {
    append({
      id: uuidv4(),
      limit: 1,
      timeWindowSeconds: 60,
      isNew: true,
    });
  };

  const onDelete = async (index: number) => {
    remove(index);
  };

  return (
    <Stack gap={8} mb={24}>
      <Stack>
        <Heading as="h2" size="md">
          Delivery Rate Limits
        </Heading>
        <Text>
          Throttle the amount of articles you get in certain time windows. This may be useful if
          you&apos;re getting too many articles from a feed.{" "}
          <chakra.span fontWeight={600}>
            Articles that exceed rate limits are dropped and will not be delivered.
          </chakra.span>
        </Text>
      </Stack>
      <FormProvider {...formMethods}>
        <form
          ref={formFocusRef}
          onSubmit={handleSubmit(onSubmit)}
          aria-label="Delivery rate limits settings"
        >
          <Stack gap={4}>
            <Stack gap={4} role="list">
              {fields.map((item, index) => {
                return (
                  <HStack
                    role="listitem"
                    key={item.id}
                    borderStyle="solid"
                    borderColor="border"
                    borderWidth={1}
                    p={4}
                    rounded="lg"
                    shadow="lg"
                    flexWrap="wrap"
                  >
                    <Field
                      invalid={!!errors.rateLimits?.[index]?.limit}
                      required
                      label="Article Limit"
                      errorText={errors.rateLimits?.[index]?.limit?.message}
                      helperText={
                        !errors.rateLimits?.[index]?.limit
                          ? "The maximum number of articles to allow for delivery."
                          : undefined
                      }
                    >
                      <Controller
                        name={`rateLimits.${index}.limit`}
                        control={control}
                        render={({
                          field: { onChange: _onChange, onBlur, value, ...fieldRest },
                        }) => (
                          <NumberInputRoot
                            min={0}
                            max={10000}
                            {...fieldRest}
                            value={String(value)}
                            onValueChange={(details) => _onChange(details.valueAsNumber)}
                          >
                            <NumberInputField onBlur={onBlur} />
                          </NumberInputRoot>
                        )}
                      />
                    </Field>
                    <Field
                      invalid={!!errors.rateLimits?.[index]?.timeWindowSeconds}
                      required
                      label="Time Window (seconds)"
                      errorText={errors.rateLimits?.[index]?.timeWindowSeconds?.message}
                      helperText={
                        !errors.rateLimits?.[index]?.timeWindowSeconds
                          ? "The duration of the time window this rate limit applies to in seconds."
                          : undefined
                      }
                    >
                      <Controller
                        name={`rateLimits.${index}.timeWindowSeconds`}
                        control={control}
                        render={({
                          field: { onChange: _onChange, onBlur, value, ...fieldRest },
                        }) => {
                          return (
                            <NumberInputRoot
                              min={0}
                              max={2592000}
                              {...fieldRest}
                              value={String(value)}
                              onValueChange={(details) => _onChange(details.valueAsNumber)}
                            >
                              <NumberInputField onBlur={onBlur} />
                            </NumberInputRoot>
                          );
                        }}
                      />
                    </Field>
                    <Box>
                      <Button
                        variant="ghost"
                        colorPalette="red"
                        onClick={() => onDelete(index)}
                        size="sm"
                      >
                        <HStack>
                          <Icon as={FaTrash} />
                          <Text>Delete rate limit</Text>
                        </HStack>
                      </Button>
                    </Box>
                    {/* <CloseButton alignSelf="flex-start" onClick={() => onDelete(index)} /> */}
                  </HStack>
                );
              })}
            </Stack>
            <Box>
              <Button onClick={onAddRateLimit} disabled={fields.length >= 10}>
                <Icon as={FaPlus} fontSize={13} />
                Add rate limit
              </Button>
            </Box>
          </Stack>
          <SavedUnsavedChangesPopupBar restoreFocusRef={formFocusRef} />
        </form>
      </FormProvider>
    </Stack>
  );
};
