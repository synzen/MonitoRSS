import {
  Box,
  Button,
  Center,
  CloseButton,
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
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { Controller, FormProvider, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { AddIcon } from "@chakra-ui/icons";
import { notifyError } from "../../../../utils/notifyError";
import { useConnection, useUpdateConnection } from "../../hooks";
import { ConfirmModal, InlineErrorAlert, SavedUnsavedChangesPopupBar } from "@/components";
import { FeedConnectionType } from "@/types";
import { notifySuccess } from "@/utils/notifySuccess";
import {
  DeliveryRateLimitsFormData,
  DeliveryRateLimitsFormSchema,
} from "./constants/DeliveryRateLimitsFormSchema";

interface Props {
  feedId: string;
  connectionId: string;
  connectionType: FeedConnectionType;
}

export const DeliveryRateLimitsTabSection = ({ feedId, connectionId, connectionType }: Props) => {
  const { connection, status, error } = useConnection({
    connectionId,
    feedId,
  });
  const { mutateAsync } = useUpdateConnection({ type: connectionType });
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
    watch,
    setValue,
  } = formMethods;
  const fields = watch("rateLimits");
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
        connectionId,
        feedId,
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
    const newData = [
      ...fields,
      {
        id: uuidv4(),
        limit: 1,
        timeWindowSeconds: 60,
        isNew: true,
      },
    ];
    setValue("rateLimits", newData, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
  };

  const onDelete = async (index: number) => {
    const newData = [...fields];

    newData.splice(index, 1);

    setValue("rateLimits", newData, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  if (error) {
    return (
      <InlineErrorAlert title={t("common.errors.somethingWentWrong")} description={error.message} />
    );
  }

  if (status === "loading") {
    return (
      <Center>
        <Spinner />
      </Center>
    );
  }

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
            {fields.map((item, index) => {
              return (
                <HStack key={item.id} bg="gray.700" p={4} rounded="lg" shadow="lg">
                  <FormControl isInvalid={!!errors.rateLimits?.[index]?.limit}>
                    <FormLabel>Article Limit</FormLabel>
                    <Controller
                      name={`rateLimits.${index}.limit`}
                      control={control}
                      render={({ field }) => (
                        <NumberInput
                          min={0}
                          {...field}
                          onChange={(str, num) => field.onChange(num)}
                        >
                          <NumberInputField bg="gray.800" />
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
                  <FormControl isInvalid={!!errors.rateLimits?.[index]?.timeWindowSeconds}>
                    <FormLabel>Time Window (seconds)</FormLabel>
                    <Controller
                      name={`rateLimits.${index}.timeWindowSeconds`}
                      control={control}
                      render={({ field }) => {
                        return (
                          <NumberInput
                            min={0}
                            {...field}
                            onChange={(str, num) => field.onChange(num)}
                          >
                            <NumberInputField bg="gray.800" />
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
                  {!item.isNew && (
                    <ConfirmModal
                      trigger={<CloseButton alignSelf="flex-start" />}
                      onConfirm={() => onDelete(index)}
                      colorScheme="red"
                      description="Are you sure you want to delete this rate limit?"
                      title="Delete Rate Limit"
                      okText="Delete"
                    />
                  )}
                  {item.isNew && (
                    <CloseButton alignSelf="flex-start" onClick={() => onDelete(index)} />
                  )}
                </HStack>
              );
            })}
            <Box>
              <Button
                colorScheme="blue"
                leftIcon={<AddIcon fontSize={13} />}
                onClick={onAddRateLimit}
                isDisabled={fields.length >= 10}
              >
                Add
              </Button>
            </Box>
          </Stack>
          <SavedUnsavedChangesPopupBar useDirtyFormCheck />
        </form>
      </FormProvider>
    </Stack>
  );
};
