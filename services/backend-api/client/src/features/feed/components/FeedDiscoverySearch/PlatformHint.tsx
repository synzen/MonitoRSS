import { Box, Text } from "@chakra-ui/react";

interface PlatformHintEntry {
  keywords: string[];
  description: string;
  example: string;
}

const PLATFORM_HINTS: PlatformHintEntry[] = [
  {
    keywords: ["youtube", "yt"],
    description: "To add a YouTube channel, paste the channel URL.",
    example: "https://www.youtube.com/@ChannelName",
  },
  {
    keywords: ["reddit"],
    description: "To add a subreddit, paste the subreddit URL.",
    example: "https://www.reddit.com/r/SubredditName",
  },
];

const EXPECTED_RESOLUTION_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "reddit.com",
  "www.reddit.com",
  "old.reddit.com",
]);

export function isExpectedResolutionUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);

    return EXPECTED_RESOLUTION_HOSTNAMES.has(hostname);
  } catch {
    return false;
  }
}

function getPlatformHint(query: string): PlatformHintEntry | null {
  const q = query.toLowerCase().trim();

  return PLATFORM_HINTS.find((hint) => hint.keywords.some((kw) => q.includes(kw))) ?? null;
}

export const PlatformHint = ({ query }: { query: string }) => {
  const hint = getPlatformHint(query);

  if (hint) {
    return (
      <Box borderWidth="1px" borderColor="blue.700" borderRadius="md" bg="blue.900" px={4} py={3}>
        <Text fontSize="sm" color="gray.100">
          {hint.description}
        </Text>
        <Text fontSize="sm" color="gray.300" mt={2}>
          For example:{" "}
          <Text as="code" fontFamily="mono">
            {hint.example}
          </Text>
        </Text>
      </Box>
    );
  }

  return (
    <Text color="gray.400">
      No matches in our popular feeds list. Many websites have feeds - try pasting a URL (e.g., a
      YouTube channel or news site) and we&apos;ll check automatically.
    </Text>
  );
};
