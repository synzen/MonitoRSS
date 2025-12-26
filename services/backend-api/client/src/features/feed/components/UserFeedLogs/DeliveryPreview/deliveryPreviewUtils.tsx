import {
  CheckIcon,
  InfoIcon,
  RepeatIcon,
  WarningIcon,
  TimeIcon,
  CloseIcon,
  WarningTwoIcon,
  QuestionOutlineIcon,
} from "@chakra-ui/icons";
import { Icon } from "@chakra-ui/react";
import { FaBan, FaLock } from "react-icons/fa";
import { IconType } from "react-icons";
import { ArticleDeliveryOutcome } from "../../../types/DeliveryPreview";

export const getOutcomeLabel = (outcome: ArticleDeliveryOutcome): string => {
  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
      return "Would Deliver";
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return "Learning";
    case ArticleDeliveryOutcome.DuplicateId:
      return "Previously Seen";
    case ArticleDeliveryOutcome.BlockedByComparison:
      return "Unchanged";
    case ArticleDeliveryOutcome.FilteredByDateCheck:
      return "Too Old";
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return "Blocked by Filters";
    case ArticleDeliveryOutcome.RateLimitedFeed:
      return "Daily Limit Reached";
    case ArticleDeliveryOutcome.RateLimitedMedium:
      return "Limit Reached";
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return "Would Deliver";
    case ArticleDeliveryOutcome.MixedResults:
      return "Mixed Results";
    case ArticleDeliveryOutcome.FeedUnchanged:
      return "No Changes";
    case ArticleDeliveryOutcome.FeedError:
      return "Feed Error";
    default:
      return "Unknown";
  }
};

export const getOutcomeColorScheme = (outcome: ArticleDeliveryOutcome): string => {
  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return "green";
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return "blue";
    case ArticleDeliveryOutcome.DuplicateId:
    case ArticleDeliveryOutcome.BlockedByComparison:
    case ArticleDeliveryOutcome.FeedUnchanged:
      return "gray";
    case ArticleDeliveryOutcome.FilteredByDateCheck:
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return "orange";
    case ArticleDeliveryOutcome.RateLimitedFeed:
    case ArticleDeliveryOutcome.RateLimitedMedium:
    case ArticleDeliveryOutcome.MixedResults:
      return "yellow";
    case ArticleDeliveryOutcome.FeedError:
      return "red";
    default:
      return "gray";
  }
};

export const getOutcomeIcon = (outcome: ArticleDeliveryOutcome) => {
  switch (outcome) {
    case ArticleDeliveryOutcome.WouldDeliver:
    case ArticleDeliveryOutcome.WouldDeliverPassingComparison:
      return CheckIcon;
    case ArticleDeliveryOutcome.FirstRunBaseline:
      return InfoIcon;
    case ArticleDeliveryOutcome.DuplicateId:
    case ArticleDeliveryOutcome.BlockedByComparison:
    case ArticleDeliveryOutcome.FeedUnchanged:
      return RepeatIcon;
    case ArticleDeliveryOutcome.FilteredByDateCheck:
    case ArticleDeliveryOutcome.FilteredByMediumFilter:
      return WarningIcon;
    case ArticleDeliveryOutcome.RateLimitedFeed:
    case ArticleDeliveryOutcome.RateLimitedMedium:
    case ArticleDeliveryOutcome.MixedResults:
      return TimeIcon;
    case ArticleDeliveryOutcome.FeedError:
      return CloseIcon;
    default:
      return CloseIcon;
  }
};

interface StatusBadgeContentProps {
  outcome: ArticleDeliveryOutcome;
  label: string;
}

export const StatusBadgeContent = ({ outcome, label }: StatusBadgeContentProps) => {
  const OutcomeIcon = getOutcomeIcon(outcome);

  return (
    <>
      <Icon as={OutcomeIcon} boxSize={3} mr={1} />
      {label}
    </>
  );
};

export type FeedErrorSeverity = "blocking" | "temporary";

export interface FeedErrorInfo {
  title: string;
  explanation: string;
  action: string;
  severity: FeedErrorSeverity;
  colorScheme: "orange" | "red" | "yellow" | "blue" | "gray";
  badgeText: string;
  badgeVariant: "solid" | "outline";
  icon: typeof WarningIcon | IconType;
}

export function getHttpStatusMessage(statusCode: number): FeedErrorInfo {
  switch (statusCode) {
    case 401:
      return {
        title: "Authentication Required",
        explanation: "This feed requires authentication to access.",
        action: "MonitoRSS can only read public feeds. You'll need to find a public alternative.",
        severity: "blocking",
        colorScheme: "orange",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "solid",
        icon: FaBan,
      };
    case 403:
      return {
        title: "Access Blocked by Publisher",
        explanation: "The feed's server is refusing access to MonitoRSS.",
        action:
          "Try contacting the publisher to see if they may unblock MonitoRSS, or finding an alternative source.",
        severity: "blocking",
        colorScheme: "orange",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "solid",
        icon: FaBan,
      };
    case 404:
      return {
        title: "Feed Not Found",
        explanation: "The feed doesn't exist at this URL.",
        action: "Check that the feed URL is correct. The feed may have been moved or removed.",
        severity: "blocking",
        colorScheme: "red",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "solid",
        icon: WarningTwoIcon,
      };
    case 410:
      return {
        title: "Feed Permanently Removed",
        explanation: "This publisher is reporting that the feed has been permanently deleted.",
        action:
          "Consider finding an alternative source, or contacting the publisher to troubleshoot.",
        severity: "blocking",
        colorScheme: "red",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "solid",
        icon: WarningTwoIcon,
      };
    case 429:
      return {
        title: "Rate Limited",
        explanation: "The feed server is temporarily blocking requests because too many were made.",
        action:
          "This usually resolves automatically. You may also try increasing your feed's refresh interval.",
        severity: "temporary",
        colorScheme: "yellow",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: TimeIcon,
      };
    case 500:
      return {
        title: "Feed Server Error",
        explanation: "The feed's server encountered an internal error.",
        action:
          "This is usually temporary. The feed should recover once the publisher fixes their server.",
        severity: "temporary",
        colorScheme: "blue",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: WarningIcon,
      };
    case 502:
      return {
        title: "Feed Server Unavailable",
        explanation:
          "The feed publisher's server infrastructure is reporting that they are having issues.",
        action: "This is usually temporary. Try refreshing in a few minutes.",
        severity: "temporary",
        colorScheme: "blue",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: WarningIcon,
      };
    case 503:
      return {
        title: "Feed Temporarily Unavailable",
        explanation: "The feed server is temporarily offline or overloaded.",
        action:
          "This is usually temporary. Try waiting a while for the feed to automatically recover.",
        severity: "temporary",
        colorScheme: "blue",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: WarningIcon,
      };
    case 504:
      return {
        title: "Feed Server Timed Out",
        explanation: "The feed server took too long to respond.",
        action:
          "This is usually temporary. If it persists, the feed server may have performance issues.",
        severity: "temporary",
        colorScheme: "blue",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: WarningIcon,
      };
    default:
      return {
        title: "Unexpected Server Response",
        explanation: `The feed server returned an unexpected status (HTTP ${statusCode}).`,
        action: "Check the feed URL in your browser. This may be a compatibility issue.",
        severity: "temporary",
        colorScheme: "gray",
        badgeText: `HTTP ${statusCode}`,
        badgeVariant: "outline",
        icon: QuestionOutlineIcon,
      };
  }
}

export function getGenericErrorMessage(feedState: string, errorType?: string): FeedErrorInfo {
  if (feedState === "fetch-error") {
    switch (errorType) {
      case "timeout":
        return {
          title: "Failed to Fetch Feed",
          explanation: "The feed server took too long to respond. This is usually temporary.",
          action:
            "This usually resolves on its own. If it persists, the feed server may have performance issues.",
          severity: "temporary",
          colorScheme: "yellow",
          badgeText: "TIMEOUT",
          badgeVariant: "outline",
          icon: TimeIcon,
        };
      case "fetch":
        return {
          title: "Failed to Fetch Feed",
          explanation:
            "Could not connect to the feed server. The server may be down or blocking requests.",
          action:
            "Check if the feed URL works in your browser. The server may be temporarily down.",
          severity: "temporary",
          colorScheme: "blue",
          badgeText: "NETWORK",
          badgeVariant: "outline",
          icon: WarningIcon,
        };
      case "internal":
        return {
          title: "Failed to Fetch Feed",
          explanation: "An unexpected error occurred. Try refreshing in a few minutes.",
          action: "Try refreshing. If this continues, contact MonitoRSS support.",
          severity: "temporary",
          colorScheme: "gray",
          badgeText: "ERROR",
          badgeVariant: "outline",
          icon: QuestionOutlineIcon,
        };
      case "invalid-ssl-certificate":
        return {
          title: "Invalid SSL Certificate",
          explanation:
            "The feed server's SSL certificate could not be verified. The certificate may be expired, self-signed, or misconfigured.",
          action:
            "Contact the feed provider about their SSL configuration, or try an alternative feed URL.",
          severity: "blocking",
          colorScheme: "orange",
          badgeText: "SSL",
          badgeVariant: "solid",
          icon: FaLock,
        };
      default:
        return {
          title: "Failed to Fetch Feed",
          explanation:
            "MonitoRSS couldn't fetch this feed. This may be temporary or indicate a problem with the feed URL.",
          action: "Check if the feed URL works in your browser. Try refreshing in a few minutes.",
          severity: "temporary",
          colorScheme: "gray",
          badgeText: "ERROR",
          badgeVariant: "outline",
          icon: QuestionOutlineIcon,
        };
    }
  }

  if (feedState === "parse-error") {
    switch (errorType) {
      case "timeout":
        return {
          title: "Failed to Parse Feed",
          explanation: "The feed took too long to parse. It may be unusually large or complex.",
          action: "Consider a feed with fewer articles if this persists.",
          severity: "temporary",
          colorScheme: "yellow",
          badgeText: "PARSE",
          badgeVariant: "outline",
          icon: TimeIcon,
        };
      case "invalid":
        return {
          title: "Failed to Parse Feed",
          explanation: "The feed contains invalid XML. Contact the feed provider if this persists.",
          action: "The feed's XML is malformed. Contact the publisher or find an alternative feed.",
          severity: "blocking",
          colorScheme: "red",
          badgeText: "PARSE",
          badgeVariant: "solid",
          icon: CloseIcon,
        };
      default:
        return {
          title: "Failed to Parse Feed",
          explanation:
            "MonitoRSS couldn't parse this feed. The feed may have invalid XML or formatting issues.",
          action: "Check if the feed URL returns valid XML in your browser.",
          severity: "temporary",
          colorScheme: "gray",
          badgeText: "PARSE",
          badgeVariant: "outline",
          icon: QuestionOutlineIcon,
        };
    }
  }

  return {
    title: "Feed Error",
    explanation: "An error occurred while processing this feed.",
    action:
      "Try refreshing. If this continues, contact MonitoRSS support at support@monitorss.xyz.",
    severity: "temporary",
    colorScheme: "gray",
    badgeText: "ERROR",
    badgeVariant: "outline",
    icon: QuestionOutlineIcon,
  };
}
