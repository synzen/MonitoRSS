import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Text,
} from "@chakra-ui/react";

const FAQItem = ({ q, a }: { q: string; a: string | React.ReactNode }) => (
  <AccordionItem role="listitem">
    <AccordionButton py={8}>
      {/* <Box as="span" flex="1" textAlign="left"> */}
      <Text fontWeight={600} size="lg" textAlign="left" flex="1">
        {q}
      </Text>
      {/* </Box> */}
      <AccordionIcon />
    </AccordionButton>
    <AccordionPanel pb={8}>{a}</AccordionPanel>
  </AccordionItem>
);

export const FAQ = ({ items }: { items: Array<{ q: string; a: string | React.ReactNode }> }) => (
  <Accordion allowMultiple borderRadius="lg" role="list" tabIndex={-1}>
    {items.map(({ q, a }) => (
      <FAQItem q={q} a={a} key={q} />
    ))}
  </Accordion>
);
