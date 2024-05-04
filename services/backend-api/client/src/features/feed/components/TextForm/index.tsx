import { InferType, object, string } from "yup";
import { Button, HStack, Stack, Textarea } from "@chakra-ui/react";
import { Controller, useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { notifyError } from "@/utils/notifyError";
import { useUpdateFeed } from "../../hooks/useUpdateFeed";

interface Props {
  feedId: string;
  text: string;
  onUpdated: () => Promise<any>;
}

const FormSchema = object({
  text: string().required(),
});

type FormValues = InferType<typeof FormSchema>;

export const TextForm: React.FC<Props> = ({ feedId, text, onUpdated }) => {
  const { t } = useTranslation();
  const { mutateAsync } = useUpdateFeed();
  const defaultValues = { text };

  const {
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { isDirty, isSubmitting },
  } = useForm<FormValues>({
    resolver: yupResolver(FormSchema),
    defaultValues,
  });

  useEffect(() => {
    setValue("text", text);
  }, [text]);

  const onUpdatedFeed = async (values: FormValues) => {
    try {
      const updatedFeed = await mutateAsync({
        feedId,
        details: {
          text: values.text,
        },
      });
      onUpdated();
      reset({
        text: updatedFeed.result.text,
      });
    } catch (error) {
      notifyError("Failed to update feed", error as Error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onUpdatedFeed)}>
      <Stack>
        <Controller
          name="text"
          control={control}
          render={({ field }) => <Textarea spellCheck={false} {...field} />}
        />
        <HStack justifyContent="flex-end">
          <Button
            isDisabled={!isDirty || isSubmitting}
            onClick={() => reset(defaultValues)}
            variant="ghost"
          >
            <span>{t("pages.message.textSectionResetButton")}</span>
          </Button>
          <Button
            type="submit"
            colorScheme="blue"
            isLoading={isSubmitting}
            isDisabled={isSubmitting || !isDirty}
          >
            <span>{t("pages.message.textSectionSaveButton")}</span>
          </Button>
        </HStack>
      </Stack>
    </form>
  );
};
