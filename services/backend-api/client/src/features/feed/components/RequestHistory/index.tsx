import { CheckIcon } from '@chakra-ui/icons';
import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Divider,
  Heading,
  HStack,
  Stack,
  Text,
  useBreakpointValue,
  useColorModeValue,
} from '@chakra-ui/react';

export const RequestHistory = () => {
  const data = [{
    status: 'Suceeded',
    statusText: 'Not Found',
    date: new Date(),
  }];

  return (
    <Accordion width="100%" allowMultiple allowToggle>
      {data.map((item) => (
        <AccordionItem
          borderRadius="lg"
          // borderStyle="solid"
          // borderWidth="2px"
          // borderColor="green.600"
          width="100%"
          border="none"
          // boxShadow="none"
          // outline="inherit"
          background="gray.700"
          outlineColor="red.400"
        >
          <HStack>
            <AccordionButton
              flexShrink={1}
              paddingX="8"
              paddingY="4"
            >
              <HStack
                width="100%"
                // paddingY="4"
                // paddingX="8"
                spacing={12}

              >
                <CheckIcon color="green.300" />
                <Stack>
                  <Text fontWeight={600} textAlign="left">{item.status}</Text>
                  <Text color="gray.400">{item.date.toISOString()}</Text>
                </Stack>
              </HStack>
              <AccordionIcon />
            </AccordionButton>
          </HStack>
          <Divider />
          <AccordionPanel>
            <Box
              px={{ base: '4', md: '6' }}
              py={{ base: '5', md: '6' }}
              // bg="gray.800"
              borderRadius="lg"
              boxShadow={useColorModeValue('sm', 'sm-dark')}
            >
              <Stack>
                <Text fontSize="sm" color="muted">
                  Status
                </Text>
                <Heading size={useBreakpointValue({ base: 'sm', md: 'md' })}>200</Heading>
              </Stack>
            </Box>
          </AccordionPanel>
        </AccordionItem>
      ))}
    </Accordion>
  );
};
