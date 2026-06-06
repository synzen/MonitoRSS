import { RadioCard as ChakraRadioCard, HStack } from "@chakra-ui/react";
import React from "react";

interface RadioCardGroupProps {
  options: string[];
}

export const RadioCardGroup = ({ options }: RadioCardGroupProps) => {
  return (
    <ChakraRadioCard.Root>
      <HStack>
        {options.map((value) => (
          <RadioCard key={value} value={value}>
            {value}
          </RadioCard>
        ))}
      </HStack>
    </ChakraRadioCard.Root>
  );
};

export const RadioCard = (
  props: ChakraRadioCard.ItemProps & {
    children: React.ReactNode;
  },
) => {
  const { children, ...rest } = props;

  return (
    <ChakraRadioCard.Item
      {...rest}
      cursor="pointer"
      borderWidth="1px"
      borderRadius="l3"
      boxShadow="md"
      px={5}
      py={3}
    >
      <ChakraRadioCard.ItemHiddenInput />
      <ChakraRadioCard.ItemControl>
        <ChakraRadioCard.ItemText>{children}</ChakraRadioCard.ItemText>
      </ChakraRadioCard.ItemControl>
    </ChakraRadioCard.Item>
  );
};
