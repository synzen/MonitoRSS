import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import relativeTime from "dayjs/plugin/relativeTime";
import { getExplanationText } from "./ArticleDeliveryDetails";
import { ArticleDeliveryOutcome } from "../../../types/DeliveryPreview";

dayjs.extend(duration);
dayjs.extend(relativeTime);

describe("getExplanationText", () => {
  const futureIso = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

  describe("WouldDeliver", () => {
    it("renders host-cache phrasing when nextRetryReason is HOST_CACHE and cacheDurationMs is set", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.WouldDeliver,
        600,
        futureIso(),
        "HOST_CACHE",
        3_600_000
      );

      expect(text).toContain("Your feed checks for new content every 10 minutes.");
      expect(text).toContain("the feed host limits how often new responses are available (about");
      expect(text).toContain("Next check expected in about");
    });

    it("renders standard refresh-rate phrasing when nextRetryReason is REFRESH_RATE", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.WouldDeliver,
        600,
        futureIso(),
        "REFRESH_RATE",
        null
      );

      expect(text).toContain("Your feed checks for new content every 10 minutes.");
      expect(text).toContain("Next check expected in about");
      expect(text).not.toContain("feed host limits how often new responses");
    });

    it("falls back to non-host-cache phrasing when reason is HOST_CACHE but cacheDurationMs is null", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.WouldDeliver,
        600,
        futureIso(),
        "HOST_CACHE",
        null
      );

      expect(text).not.toContain("feed host limits how often new responses");
      expect(text).toContain("Your feed checks for new content every 10 minutes.");
    });

    it("omits next-check sentence when nextRetryAtIso is null", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.WouldDeliver,
        600,
        null,
        "REFRESH_RATE",
        null
      );

      expect(text).toContain("Your feed checks for new content every 10 minutes.");
      expect(text).not.toContain("Next check expected in about");
    });
  });

  describe("WouldDeliverPassingComparison", () => {
    it("renders host-cache phrasing (shared branch with WouldDeliver)", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.WouldDeliverPassingComparison,
        600,
        futureIso(),
        "HOST_CACHE",
        3_600_000
      );

      expect(text).toContain("This article was seen before");
      expect(text).toContain("the feed host limits how often new responses are available (about");
    });
  });

  describe("non-deliver outcomes", () => {
    it("does not render host-cache phrasing for DuplicateId regardless of reason", () => {
      const text = getExplanationText(
        ArticleDeliveryOutcome.DuplicateId,
        600,
        futureIso(),
        "HOST_CACHE",
        3_600_000
      );

      expect(text).toContain("MonitoRSS has already seen this article");
      expect(text).not.toContain("feed host limits how often new responses");
      expect(text).not.toContain("Your feed checks for new content every");
    });
  });
});
