import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TestSendErrorPanel, TestSendErrorPanelProps } from "./index";
import { SendTestArticleDeliveryStatus } from "@/types";
import { TestSendFeedback } from "../../types";

interface TestWrapperProps {
  children: React.ReactNode;
}

const TestWrapper = ({ children }: TestWrapperProps) => <ChakraProvider>{children}</ChakraProvider>;

const createFeedback = (overrides: Partial<TestSendFeedback> = {}): TestSendFeedback => ({
  status: "error",
  message: "Discord couldn't process this message.",
  deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
  ...overrides,
});

const defaultProps: TestSendErrorPanelProps = {
  feedback: createFeedback(),
  onTryAnother: vi.fn(),
  onUseAnyway: vi.fn(),
};

const renderComponent = (props: Partial<TestSendErrorPanelProps> = {}) =>
  render(
    <TestWrapper>
      <TestSendErrorPanel {...defaultProps} {...props} />
    </TestWrapper>
  );

describe("TestSendErrorPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders error headline with icon", () => {
      renderComponent();

      expect(screen.getByText(/Discord couldn't send this preview/i)).toBeInTheDocument();
    });

    it("renders user-friendly error message", () => {
      const feedback = createFeedback({
        message: "The template has placeholders that couldn't be filled.",
      });
      renderComponent({ feedback });

      expect(
        screen.getByText("The template has placeholders that couldn't be filled.")
      ).toBeInTheDocument();
    });

    it("renders warning callout about articles not delivering", () => {
      renderComponent();

      expect(
        screen.getByText(/Some articles may not deliver with this template/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/the connection will pause until you adjust the format/i)
      ).toBeInTheDocument();
    });

    it('renders "Try Another Template" button', () => {
      renderComponent();

      expect(screen.getByRole("button", { name: /Try Another Template/i })).toBeInTheDocument();
    });

    it('renders "Use this template" button', () => {
      renderComponent();

      expect(screen.getByRole("button", { name: /Use this template/i })).toBeInTheDocument();
    });
  });

  describe("Technical Details", () => {
    it("renders collapsible Technical Details button when API details are present", () => {
      const feedback = createFeedback({
        apiPayload: { content: "", embeds: [] },
        apiResponse: { code: 50006, message: "Cannot send an empty message" },
      });
      renderComponent({ feedback });

      expect(screen.getByRole("button", { name: /Technical Details/i })).toBeInTheDocument();
    });

    it("does not render Technical Details button when no API details present", () => {
      const feedback = createFeedback({
        apiPayload: undefined,
        apiResponse: undefined,
      });
      renderComponent({ feedback });

      expect(screen.queryByRole("button", { name: /Technical Details/i })).not.toBeInTheDocument();
    });

    it("shows Technical Details collapsed by default", () => {
      const feedback = createFeedback({
        apiPayload: { content: "test" },
      });
      renderComponent({ feedback });

      const detailsButton = screen.getByRole("button", {
        name: /Technical Details/i,
      });
      expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    });

    it("expands Technical Details when clicked", async () => {
      const user = userEvent.setup();
      const feedback = createFeedback({
        apiPayload: { content: "test" },
        apiResponse: { code: 50006 },
      });
      renderComponent({ feedback });

      const detailsButton = screen.getByRole("button", {
        name: /Technical Details/i,
      });
      await user.click(detailsButton);

      expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    });

    it("displays API payload when expanded", async () => {
      const user = userEvent.setup();
      const feedback = createFeedback({
        apiPayload: { content: "test content", embeds: [{ title: "Embed" }] },
      });
      renderComponent({ feedback });

      const detailsButton = screen.getByRole("button", {
        name: /Technical Details/i,
      });
      await user.click(detailsButton);

      expect(screen.getByText(/Request Sent to Discord/i)).toBeInTheDocument();
      expect(screen.getByText(/"content": "test content"/)).toBeInTheDocument();
    });

    it("displays API response when expanded", async () => {
      const user = userEvent.setup();
      const feedback = createFeedback({
        apiResponse: { code: 50006, message: "Cannot send an empty message" },
      });
      renderComponent({ feedback });

      const detailsButton = screen.getByRole("button", {
        name: /Technical Details/i,
      });
      await user.click(detailsButton);

      expect(screen.getByText(/Discord's Response/i)).toBeInTheDocument();
      expect(screen.getByText(/"code": 50006/)).toBeInTheDocument();
    });
  });

  describe("button interactions", () => {
    it('calls onTryAnother when "Try Another Template" is clicked', async () => {
      const onTryAnother = vi.fn();
      const user = userEvent.setup();
      renderComponent({ onTryAnother });

      await user.click(screen.getByRole("button", { name: /Try Another Template/i }));

      expect(onTryAnother).toHaveBeenCalledTimes(1);
    });

    it('calls onUseAnyway when "Use this template" is clicked', async () => {
      const onUseAnyway = vi.fn();
      const user = userEvent.setup();
      renderComponent({ onUseAnyway });

      await user.click(screen.getByRole("button", { name: /Use this template/i }));

      expect(onUseAnyway).toHaveBeenCalledTimes(1);
    });

    it("shows loading state on Use this template button when isUseAnywayLoading is true", () => {
      renderComponent({ isUseAnywayLoading: true });

      const useAnywayButton = screen.getByRole("button", {
        name: /Use this template/i,
      });
      expect(useAnywayButton).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    it('has role="region" with proper aria attributes', () => {
      renderComponent();

      const panel = screen.getByRole("region", { name: /Discord couldn't send this preview/i });
      expect(panel).toBeInTheDocument();
    });

    it("has aria-labelledby pointing to heading", () => {
      renderComponent();

      const panel = screen.getByRole("region", { name: /Discord couldn't send this preview/i });
      expect(panel).toHaveAttribute("aria-labelledby", "test-send-error-heading");
    });

    it("has aria-describedby pointing to description", () => {
      renderComponent();

      const panel = screen.getByRole("region", { name: /Discord couldn't send this preview/i });
      expect(panel).toHaveAttribute("aria-describedby", "test-send-error-description");
    });
  });
});
