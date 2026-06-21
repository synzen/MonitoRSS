import { Text } from "@chakra-ui/react";
import { getLegacyInvoiceLabel, ProductKey } from "@/constants";

// A low-emphasis reassurance line for subscribers on the repackaged team tiers,
// whose Paddle receipts still literally read "Tier 2"/"Tier 3". It bridges the
// new plan name shown in-app to the older label on their invoices. Renders
// nothing for Free/Personal/new buyers, who never saw a "Tier N" invoice.
//
// Place this in the same semantic block as the plan name so a screen reader
// reads the name and this clarification together, not as a detached aside.
export const LegacyInvoiceNote = ({ productKey }: { productKey?: ProductKey }) => {
  const legacyLabel = productKey ? getLegacyInvoiceLabel(productKey) : undefined;

  if (!legacyLabel) {
    return null;
  }

  return (
    <Text color="fg.muted" fontSize="sm">
      Older invoices may list this plan as &quot;{legacyLabel}.&quot;
    </Text>
  );
};
