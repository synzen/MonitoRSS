import { BoxProps } from "@chakra-ui/react";

export const ARTICLE_LIST_CONTAINER_PROPS: BoxProps = {
  border: "1px solid",
  borderColor: "gray.700",
  borderRadius: "md",
  overflow: "hidden",
};

export const ARTICLE_LIST_ITEM_PADDING: BoxProps = {
  px: 3,
  py: 2,
};

export const getArticleListItemBorderProps = (
  isFirst: boolean,
  leftBorderColor: string = "gray.500"
): BoxProps => ({
  borderTop: isFirst ? "none" : "1px solid",
  borderTopColor: "gray.700",
  borderLeft: "3px solid",
  borderLeftColor: leftBorderColor,
});
