import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import {
  BOX_CONSTRAINED_MAX_WIDTH,
  BOX_CONSTRAINED_PADDING_X,
} from "../BoxConstrainedWidth";

const links = [
  { label: "Terms", href: "https://monitorss.xyz/terms" },
  { label: "Privacy", href: "https://monitorss.xyz/privacy-policy" },
  { label: "Cookie Policy", href: "https://monitorss.xyz/cookie-policy" },
  { label: "Support", href: "https://discord.gg/pudv7Rx" },
];

// TODO(legal-footer): re-add the isOfficialMonitoRSSHost gate from
// ./constants before merge so self-hosted instances don't link to the hosted
// legal docs. Gating is disabled for now for local testing.
export const AppLegalFooter = () => {
  const { pathname } = useLocation();
  const currentYear = new Date().getFullYear();

  // The message builder is intentionally full-screen and chrome-free.
  if (pathname.endsWith("/message-builder")) {
    return null;
  }

  return (
    <Box
      as="footer"
      mt="auto"
      width="100%"
      flexShrink={0}
      borderTopWidth="1px"
      borderColor="border"
    >
      <Flex
        maxWidth={BOX_CONSTRAINED_MAX_WIDTH}
        mx="auto"
        paddingX={BOX_CONSTRAINED_PADDING_X}
        py="3"
        gap="4"
        align="center"
        justify="space-between"
        flexWrap="wrap"
      >
        <Box>
          <Text fontSize="sm" color="fg.muted">
            MonitoRSS
          </Text>
          <Text fontSize="sm" color="fg.muted">
            © {currentYear} Relayvale LLC
          </Text>
        </Box>
        <Flex as="nav" aria-label="Legal" gap="3" flexWrap="wrap">
          {links.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              fontSize="sm"
              color="fg.muted"
              _hover={{ textDecoration: "underline" }}
            >
              {label}
            </Link>
          ))}
        </Flex>
      </Flex>
    </Box>
  );
};
