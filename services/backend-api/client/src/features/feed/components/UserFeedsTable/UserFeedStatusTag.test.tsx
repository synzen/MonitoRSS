import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, expect, it } from "vitest";
import { system } from "@/utils/theme";
import { UserFeedComputedStatus } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";

const renderStatusTag = (status: UserFeedComputedStatus) =>
  render(
    <ChakraProvider value={system}>
      <UserFeedStatusTag status={status} />
    </ChakraProvider>,
  );

describe("UserFeedStatusTag", () => {
  it("labels a recovering feed as currently retrying", () => {
    renderStatusTag(UserFeedComputedStatus.Retrying);

    expect(
      screen.getByLabelText("Currently retrying after failed requests"),
    ).toBeInTheDocument();
  });

  it("labels an exhausted feed as requiring attention", () => {
    renderStatusTag(UserFeedComputedStatus.RequiresAttention);

    expect(screen.getByLabelText("Requires attention")).toBeInTheDocument();
  });
});
