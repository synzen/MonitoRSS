import { Box, Flex, chakra } from "@chakra-ui/react";
import { uniqueId } from "lodash";

interface Props {
  components: Array<{
    type: number;
    style: number;
    label: string;
    url?: string;
  }>;
}

export const ComponentRowView = ({ components }: Props) => {
  const onClickLink = (url: string) => {
    window.open(url, "_blank", "noopener noreferrer");
  };

  return (
    <Flex flexWrap="wrap">
      {components.map((c) => (
        <chakra.button
          key={uniqueId()}
          marginTop="4px"
          marginRight="8px"
          marginBottom="4px"
          marginLeft="0"
          paddingY="2px"
          paddingX="16px"
          height="32px"
          borderRadius="3px"
          bgColor="rgb(78, 80, 88)"
          fontSize="14px"
          overflow="hidden"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();

            if (c.url) {
              onClickLink(c.url);
            }
          }}
          transition="background-color 0.17s ease, color 0.17s ease"
          _hover={{
            bg: "rgb(109, 111, 120)",
          }}
          _active={{
            bg: "rgb(109, 111, 120)",
          }}
          _visited={{
            textDecoration: "underline",
          }}
        >
          <Flex
            alignItems="center"
            margin="auto"
            justifyContent="center"
            overflow="hidden"
            minWidth="32px"
          >
            <Box
              display="inline"
              overflow="hidden"
              textOverflow="ellipsis"
              whiteSpace="nowrap"
              flexShrink={1}
            >
              {c.label}
            </Box>
            <chakra.svg
              display="inline-block"
              marginLeft="8px"
              aria-hidden="true"
              role="img"
              width="16px"
              height="16px"
              viewBox="0 0 24 24"
            >
              <path
                fill="currentColor"
                d="M10 5V3H5.375C4.06519 3 3 4.06519 3 5.375V18.625C3 19.936 4.06519 21 5.375 21H18.625C19.936 21 21 19.936 21 18.625V14H19V19H5V5H10Z"
              />
              <path
                fill="currentColor"
                d="M21 2.99902H14V4.99902H17.586L9.29297 13.292L10.707 14.706L19 6.41302V9.99902H21V2.99902Z"
              />
            </chakra.svg>
          </Flex>
        </chakra.button>
      ))}
    </Flex>
  );
};
