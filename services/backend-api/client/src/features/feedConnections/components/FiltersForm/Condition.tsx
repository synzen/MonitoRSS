import {
  Button,
  ButtonGroup,
  CloseButton,
  Flex,
  FormControl,
  HStack,
  Select,
} from "@chakra-ui/react";
import { Controller, useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import {
  RelationalExpressionLeftOperandType,
  RelationalExpressionOperator,
  RelationalExpressionRightOperandType,
} from "../../types";
import { ArticlePropertySelect } from "./ArticlePropertySelect";
import { ConditionInput } from "./ConditionInput";
import { GetUserFeedArticlesInput } from "../../../feed/api";

const { Equals, Contains, Matches } = RelationalExpressionOperator;

interface Props {
  onDelete: () => void;
  prefix?: string;
  deletable?: boolean;
  data: {
    feedId?: string;
  };
  articleFormatter: GetUserFeedArticlesInput["data"]["formatter"];
}

export const Condition = ({ onDelete, prefix = "", deletable, data, articleFormatter }: Props) => {
  const { control, watch } = useFormContext();

  const { t } = useTranslation();
  const leftOperandType = watch(`${prefix}left.type`) as
    | RelationalExpressionLeftOperandType
    | RelationalExpressionRightOperandType;

  let leftOperandElement: React.ReactElement = (
    <ConditionInput
      controllerName={`${prefix}left.value`}
      placeholder={t("features.feedConnections.components.filtersForm.placeholderArticleProperty")}
    />
  );

  if (leftOperandType === RelationalExpressionLeftOperandType.Article) {
    leftOperandElement = (
      <ArticlePropertySelect
        controllerName={`${prefix}left.value`}
        data={data}
        placeholder={t(
          "features.feedConnections.components.filtersForm.placeholderSelectArticleProperty"
        )}
        articleFormatter={articleFormatter}
      />
    );
  }

  return (
    <HStack width="100%" alignItems="flex-start">
      <HStack width="100%" spacing={8} alignItems="flex-start" overflow="auto" pb={2}>
        {leftOperandElement}
        <FormControl width="min-content">
          <Controller
            name={`${prefix}not`}
            control={control}
            render={({ field }) => {
              return (
                <ButtonGroup isAttached variant="outline">
                  <Button
                    onClick={() => field.onChange(false)}
                    colorScheme={!field.value ? "blue" : undefined}
                    variant={!field.value ? "solid" : "outline"}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoes")}
                  </Button>
                  <Button
                    onClick={() => field.onChange(true)}
                    colorScheme={field.value ? "blue" : undefined}
                    variant={field.value ? "solid" : "outline"}
                  >
                    {t("features.feedConnections.components.filtersForm.relationalOpDoesNot")}
                  </Button>
                </ButtonGroup>
              );
            }}
          />
        </FormControl>
        <FormControl>
          <Controller
            name={`${prefix}op`}
            control={control}
            render={({ field }) => {
              return (
                <Select flexShrink={1} minWidth={150} {...field}>
                  <option value={Equals}>
                    {t("features.feedConnections.components.filtersForm.relationalOpEquals")}
                  </option>
                  <option value={Contains}>
                    {t("features.feedConnections.components.filtersForm.relationalOpContains")}
                  </option>
                  <option value={Matches}>
                    {t("features.feedConnections.components.filtersForm.relationalOpMatches")}
                  </option>
                </Select>
              );
            }}
          />
        </FormControl>
        <ConditionInput
          controllerName={`${prefix}right.value`}
          placeholder={t("features.feedConnections.components.filtersForm.placeholderArticleValue")}
        />
      </HStack>
      {deletable && (
        <Flex>
          <CloseButton aria-label="Delete condition" size="sm" onClick={onDelete} />
        </Flex>
      )}
    </HStack>
  );
};
