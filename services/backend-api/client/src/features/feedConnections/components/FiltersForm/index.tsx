import { Box, BoxProps, Button, HStack, Stack, TableHeadProps } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import React from "react";
import {
  FilterExpressionType,
  LogicalExpressionOperator,
  LogicalFilterExpression,
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from "../../types";
import { LogicalExpressionForm } from "./LogicalExpressionForm";
import { ArticleFilterResults } from "../ArticleFilterResults";
import NavigableTree, { NavigableTreeItem } from "../../../../components/NavigableTree";
import { getAriaLabelForExpressionGroup } from "./utils/getAriaLabelForExpressionGroup";
import { SavedUnsavedChangesPopupBar } from "../../../../components";

interface FormData {
  expression: LogicalFilterExpression | null;
}

interface Props {
  expression?: LogicalFilterExpression | null;
  onSave: (expression: LogicalFilterExpression | null) => Promise<void>;
  formContainerProps?: BoxProps;
  previewContainerProps?: {
    thead: TableHeadProps;
  };
  previewTitle?: React.ReactNode;
}

export const FiltersForm = ({
  expression = null,
  onSave,
  previewTitle,
  previewContainerProps,
  formContainerProps,
}: Props) => {
  const { t } = useTranslation();
  const formMethods = useForm<FormData>({
    mode: "onChange",
    defaultValues: {
      expression,
    },
  });
  const {
    handleSubmit,
    control,
    formState: { isDirty, isSubmitting },
    setValue,
    resetField,
    reset,
  } = formMethods;

  // @ts-ignore cyclical references in typescript types
  const watchedExpression = useWatch({
    control,
    name: "expression",
  });

  const onClickReset = (e?: React.MouseEvent) => {
    e?.preventDefault();
    resetField("expression");
  };

  const onDeletedExpression = async () => {
    setValue("expression", null, {
      shouldDirty: true,
    });
  };

  const onSaveExpression = async ({ expression: finalExpression }: FormData) => {
    try {
      await onSave(finalExpression);
      reset({
        expression: finalExpression,
      });
    } catch (err) {}
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // By default, this submit will also trigger wrapping forms to submit.
    e.stopPropagation();

    return handleSubmit(onSaveExpression)(e);
  };

  const addInitialExpression = () => {
    setValue(
      "expression",
      {
        type: FilterExpressionType.Logical,
        op: LogicalExpressionOperator.And,
        children: [
          {
            type: FilterExpressionType.Relational,
            op: RelationalExpressionOperator.Equals,
            left: {
              type: RelationalExpressionLeftOperandType.Article,
              value: "",
            },
            right: {
              type: RelationalExpressionRightOperandType.String,
              value: "",
            },
          },
        ],
      },
      {
        shouldDirty: true,
      }
    );
  };

  if (!watchedExpression) {
    return (
      <FormProvider {...formMethods}>
        <form onSubmit={onSubmit}>
          <Stack spacing={8}>
            <Stack>
              <Button onClick={addInitialExpression}>
                <span>
                  {t("features.feedConnections.components.filtersForm.addNewFiltersButtonText")}
                </span>
              </Button>
              <HStack justifyContent="flex-end">
                <Button
                  colorScheme="blue"
                  type="submit"
                  isLoading={isSubmitting}
                  isDisabled={!isDirty || isSubmitting}
                >
                  <span>{t("common.buttons.save")}</span>
                </Button>
              </HStack>
            </Stack>
            <ArticleFilterResults
              filters={watchedExpression}
              title={previewTitle}
              tableContainer={{
                theadProps: previewContainerProps?.thead,
              }}
            />
          </Stack>
        </form>
      </FormProvider>
    );
  }

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={onSubmit}>
        <Stack spacing={12}>
          <Stack>
            <NavigableTree accessibleLabel="Filter expression">
              <NavigableTreeItem
                isRootItem
                id="expression."
                ariaLabel={getAriaLabelForExpressionGroup(watchedExpression.op)}
              >
                <LogicalExpressionForm
                  onDeleted={onDeletedExpression}
                  prefix="expression."
                  containerProps={formContainerProps}
                />
              </NavigableTreeItem>
            </NavigableTree>
          </Stack>
          <ArticleFilterResults
            filters={watchedExpression}
            title={previewTitle}
            tableContainer={{
              theadProps: previewContainerProps?.thead,
            }}
          />
        </Stack>
        <SavedUnsavedChangesPopupBar useDirtyFormCheck />
      </form>
    </FormProvider>
  );
};
