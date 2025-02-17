import {
  Box,
  Button,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  HStack,
  Heading,
  NumberDecrementStepper,
  NumberIncrementStepper,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { Controller, FormProvider, useFieldArray, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { AddIcon, DeleteIcon } from "@chakra-ui/icons";
import { notifyError } from "../../../../utils/notifyError";
import { useUpdateConnection } from "../../hooks";
import { SavedUnsavedChangesPopupBar } from "@/components";
import { notifySuccess } from "@/utils/notifySuccess";
import {
  DeliveryRateLimitsFormData,
  DeliveryRateLimitsFormSchema,
} from "./constants/DeliveryRateLimitsFormSchema";
import { useUserFeedConnectionContext } from "../../../../contexts/UserFeedConnectionContext";

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
  const { t } = useTranslation();
  const currentData = connection?.rateLimits;

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
      notifySuccess(t("common.success.savedChanges"));
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
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
    <Stack spacing={8} mb={24}>
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
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={4}>
            <Stack spacing={4} role="list">
              {fields.map((item, index) => {
                return (
                  <HStack
                    role="listitem"
                    key={item.id}
                    // bg="gray.700"
                    borderStyle="solid"
                    borderColor="gray.600"
                    borderWidth={1}
                    p={4}
                    rounded="lg"
                    shadow="lg"
                  >
                    <FormControl isInvalid={!!errors.rateLimits?.[index]?.limit} isRequired>
                      <FormLabel>Article Limit</FormLabel>
                      <Controller
                        name={`rateLimits.${index}.limit`}
                        control={control}
                        render={({ field }) => (
                          <NumberInput
                            min={0}
                            max={10000}
                            {...field}
                            onChange={(str, num) => field.onChange(num)}
                          >
                            <NumberInputField />
                            <NumberInputStepper>
                              <NumberIncrementStepper />
                              <NumberDecrementStepper />
                            </NumberInputStepper>
                          </NumberInput>
                        )}
                      />
                      {!errors.rateLimits?.[index]?.limit && (
                        <FormHelperText>
                          The maximum number of articles to allow for delivery.
                        </FormHelperText>
                      )}
                      {errors.rateLimits?.[index]?.limit && (
                        <FormErrorMessage>
                          {errors.rateLimits?.[index]?.limit?.message}
                        </FormErrorMessage>
                      )}
                    </FormControl>
                    <FormControl
                      isInvalid={!!errors.rateLimits?.[index]?.timeWindowSeconds}
                      isRequired
                    >
                      <FormLabel>Time Window (seconds)</FormLabel>
                      <Controller
                        name={`rateLimits.${index}.timeWindowSeconds`}
                        control={control}
                        render={({ field }) => {
                          return (
                            <NumberInput
                              min={0}
                              max={2592000}
                              {...field}
                              onChange={(str, num) => field.onChange(num)}
                            >
                              <NumberInputField />
                              <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                              </NumberInputStepper>
                            </NumberInput>
                          );
                        }}
                      />
                      {!errors.rateLimits?.[index]?.timeWindowSeconds && (
                        <FormHelperText>
                          The duration of the time window this rate limit applies to in seconds.
                        </FormHelperText>
                      )}
                      {errors.rateLimits?.[index]?.timeWindowSeconds && (
                        <FormErrorMessage>
                          {errors.rateLimits?.[index]?.timeWindowSeconds?.message}
                        </FormErrorMessage>
                      )}
                    </FormControl>
                    <Box>
                      <Button
                        variant="ghost"
                        colorScheme="red"
                        onClick={() => onDelete(index)}
                        size="sm"
                      >
                        <HStack>
                          <DeleteIcon />
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
              <Button
                leftIcon={<AddIcon fontSize={13} />}
                onClick={onAddRateLimit}
                isDisabled={fields.length >= 10}
              >
                Add rate limit
              </Button>
            </Box>
          </Stack>
          <SavedUnsavedChangesPopupBar />
        </form>
      </FormProvider>
    </Stack>
  );
};
