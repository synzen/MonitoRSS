import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, Mock } from "vitest";
import { useTestSendFlow, getErrorMessageByStatus } from "./useTestSendFlow";
import { useSendTestArticleDirect } from "./useSendTestArticleDirect";
import { SendTestArticleDeliveryStatus } from "@/types";

vi.mock("./useSendTestArticleDirect");

const mockUseSendTestArticleDirect = useSendTestArticleDirect as Mock;

describe("getErrorMessageByStatus", () => {
  it("returns correct message for BAD_PAYLOAD", () => {
    const message = getErrorMessageByStatus(SendTestArticleDeliveryStatus.BadPayload);
    expect(message).toContain("Discord couldn't process this message");
  });

  it("returns correct message for MISSING_CHANNEL", () => {
    const message = getErrorMessageByStatus(SendTestArticleDeliveryStatus.MissingChannel);
    expect(message).toContain("Discord channel could not be found");
  });

  it("returns correct message for MISSING_APPLICATION_PERMISSION", () => {
    const message = getErrorMessageByStatus(
      SendTestArticleDeliveryStatus.MissingApplicationPermission
    );
    expect(message).toContain("doesn't have permission");
  });

  it("returns correct message for TOO_MANY_REQUESTS", () => {
    const message = getErrorMessageByStatus(SendTestArticleDeliveryStatus.TooManyRequests);
    expect(message).toContain("rate limiting");
  });

  it("returns correct message for THIRD_PARTY_INTERNAL_ERROR", () => {
    const message = getErrorMessageByStatus(SendTestArticleDeliveryStatus.ThirdPartyInternalError);
    expect(message).toContain("Discord encountered an internal error");
  });

  it("returns correct message for NO_ARTICLES", () => {
    const message = getErrorMessageByStatus(SendTestArticleDeliveryStatus.NoArticles);
    expect(message).toContain("No articles available");
  });

  it("returns default message for unknown status", () => {
    const message = getErrorMessageByStatus("UNKNOWN_STATUS" as SendTestArticleDeliveryStatus);
    expect(message).toContain("Failed to send test article");
  });
});

describe("useTestSendFlow", () => {
  const mockMutateAsync = vi.fn();

  const defaultOptions = {
    feedId: "feed-123",
    channelId: "channel-456",
    threadId: undefined,
    webhookName: undefined,
    webhookIconUrl: undefined,
    selectedTemplateId: "template-1",
    selectedArticleId: "article-1",
    isOpen: true,
    createConnection: vi.fn(),
    updateConnectionTemplate: vi.fn(),
    onSaveSuccess: vi.fn(),
    onClose: vi.fn(),
    getConnectionName: vi.fn(() => "Test Channel"),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSendTestArticleDirect.mockReturnValue({
      mutateAsync: mockMutateAsync,
    });
  });

  describe("handleTestSend", () => {
    it("sets success feedback when result.status is SUCCESS", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          status: SendTestArticleDeliveryStatus.Success,
        },
      });

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).toEqual({
        status: "success",
        message: "Article sent to Discord successfully!",
      });
    });

    it("sets error feedback with details when result.status is BAD_PAYLOAD", async () => {
      const apiPayload = { content: "", embeds: [] };
      const apiResponse = { code: 50006, message: "Cannot send an empty message" };

      mockMutateAsync.mockResolvedValue({
        result: {
          status: SendTestArticleDeliveryStatus.BadPayload,
          apiPayload,
          apiResponse,
        },
      });

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).toEqual({
        status: "error",
        message: expect.stringContaining("Discord couldn't process this message"),
        deliveryStatus: SendTestArticleDeliveryStatus.BadPayload,
        apiPayload,
        apiResponse,
      });
    });

    it("sets error feedback when result.status is MISSING_CHANNEL", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          status: SendTestArticleDeliveryStatus.MissingChannel,
        },
      });

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback?.status).toBe("error");
      expect(result.current.testSendFeedback?.deliveryStatus).toBe(
        SendTestArticleDeliveryStatus.MissingChannel
      );
    });

    it("includes apiPayload and apiResponse when present in error response", async () => {
      const apiPayload = { content: "test", embeds: [{ title: "Test" }] };
      const apiResponse = { code: 50001, message: "Missing Access" };

      mockMutateAsync.mockResolvedValue({
        result: {
          status: SendTestArticleDeliveryStatus.MissingApplicationPermission,
          apiPayload,
          apiResponse,
        },
      });

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback?.apiPayload).toEqual(apiPayload);
      expect(result.current.testSendFeedback?.apiResponse).toEqual(apiResponse);
    });

    it("sets generic error feedback when mutation throws", async () => {
      mockMutateAsync.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).toEqual({
        status: "error",
        message: "Failed to send test article. Please try again.",
      });
      expect(result.current.testSendFeedback?.deliveryStatus).toBeUndefined();
    });

    it("sets isTestSending to true during test send", async () => {
      let resolvePromise: (value: unknown) => void;
      const promise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockMutateAsync.mockReturnValue(promise);

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      act(() => {
        result.current.handleTestSend();
      });

      expect(result.current.isTestSending).toBe(true);

      await act(async () => {
        resolvePromise!({
          result: { status: SendTestArticleDeliveryStatus.Success },
        });
        await promise;
      });

      expect(result.current.isTestSending).toBe(false);
    });
  });

  describe("clearTestSendFeedback", () => {
    it("clears the test send feedback", async () => {
      mockMutateAsync.mockResolvedValue({
        result: {
          status: SendTestArticleDeliveryStatus.BadPayload,
          apiPayload: { content: "" },
        },
      });

      const { result } = renderHook(() => useTestSendFlow(defaultOptions));

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).not.toBeNull();

      act(() => {
        result.current.clearTestSendFeedback();
      });

      expect(result.current.testSendFeedback).toBeNull();
    });
  });

  describe("feedback reset on selection change", () => {
    it("clears feedback when selectedTemplateId changes", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { status: SendTestArticleDeliveryStatus.Success },
      });

      const { result, rerender } = renderHook((props) => useTestSendFlow(props), {
        initialProps: defaultOptions,
      });

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).not.toBeNull();

      rerender({ ...defaultOptions, selectedTemplateId: "template-2" });

      await waitFor(() => {
        expect(result.current.testSendFeedback).toBeNull();
      });
    });

    it("clears feedback when selectedArticleId changes", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { status: SendTestArticleDeliveryStatus.Success },
      });

      const { result, rerender } = renderHook((props) => useTestSendFlow(props), {
        initialProps: defaultOptions,
      });

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).not.toBeNull();

      rerender({ ...defaultOptions, selectedArticleId: "article-2" });

      await waitFor(() => {
        expect(result.current.testSendFeedback).toBeNull();
      });
    });
  });

  describe("modal close reset", () => {
    it("resets all state when modal closes", async () => {
      mockMutateAsync.mockResolvedValue({
        result: { status: SendTestArticleDeliveryStatus.Success },
      });

      const { result, rerender } = renderHook((props) => useTestSendFlow(props), {
        initialProps: defaultOptions,
      });

      await act(async () => {
        await result.current.handleTestSend();
      });

      expect(result.current.testSendFeedback).not.toBeNull();

      rerender({ ...defaultOptions, isOpen: false });

      await waitFor(() => {
        expect(result.current.testSendFeedback).toBeNull();
        expect(result.current.createdConnectionId).toBeUndefined();
        expect(result.current.isSaving).toBe(false);
        expect(result.current.isTestSending).toBe(false);
      });
    });
  });
});
