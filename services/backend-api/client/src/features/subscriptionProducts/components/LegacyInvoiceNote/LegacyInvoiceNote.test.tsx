import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect } from "vitest";
import { system } from "@/utils/theme";
import { ProductKey } from "@/constants";
import { LegacyInvoiceNote } from "./index";

const renderNote = (productKey?: ProductKey) =>
  render(
    <ChakraProvider value={system}>
      <LegacyInvoiceNote productKey={productKey} />
    </ChakraProvider>,
  );

describe("LegacyInvoiceNote", () => {
  it("reassures a Tier 2 subscriber with the legacy invoice label", () => {
    renderNote(ProductKey.Tier2);

    expect(
      screen.getByText(/older invoices may list this plan as "Tier 2\."/i),
    ).toBeInTheDocument();
  });

  it("reassures a Tier 3 subscriber with the legacy invoice label", () => {
    renderNote(ProductKey.Tier3);

    expect(
      screen.getByText(/older invoices may list this plan as "Tier 3\."/i),
    ).toBeInTheDocument();
  });

  it("uses the Tier 3 label for the per-feed add-on product", () => {
    renderNote(ProductKey.Tier3Feed);

    expect(
      screen.getByText(/older invoices may list this plan as "Tier 3\."/i),
    ).toBeInTheDocument();
  });

  it.each([ProductKey.Free, ProductKey.Tier1, undefined])(
    "renders nothing for non-legacy case %s",
    (productKey) => {
      const { container } = renderNote(productKey);

      expect(container).toBeEmptyDOMElement();
    },
  );
});
