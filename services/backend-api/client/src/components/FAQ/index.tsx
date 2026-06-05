import { Text } from "@chakra-ui/react";
import {
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
  AccordionRoot,
} from "@/components/ui/accordion";

const FAQItem = ({ q, a }: { q: string; a: string | React.ReactNode }) => (
  <AccordionItem value={q} role="listitem">
    <AccordionItemTrigger py={8}>
      {/* <Box as="span" flex="1" textAlign="left"> */}
      <Text fontWeight={600} textStyle="lg" textAlign="left" flex="1">
        {q}
      </Text>
      {/* </Box> */}
    </AccordionItemTrigger>
    <AccordionItemContent pb={8}>{a}</AccordionItemContent>
  </AccordionItem>
);

export const FAQ = ({ items }: { items: Array<{ q: string; a: string | React.ReactNode }> }) => (
  <AccordionRoot multiple borderRadius="lg" role="list" tabIndex={-1}>
    {items.map(({ q, a }) => (
      <FAQItem q={q} a={a} key={q} />
    ))}
  </AccordionRoot>
);
