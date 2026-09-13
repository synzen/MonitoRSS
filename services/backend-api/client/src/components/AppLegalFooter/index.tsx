import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import {
  BOX_CONSTRAINED_MAX_WIDTH,
  BOX_CONSTRAINED_PADDING_X,
} from "../BoxConstrainedWidth";
import { isOfficialMonitoRSSHost, LEGAL_IDENTITY_EFFECTIVE_AT } from "./constants";

const links = [
  { label: "Terms", href: "https://monitorss.xyz/legal/terms" },
  { label: "Privacy", href: "https://monitorss.xyz/legal/privacy" },
  { label: "Cookie Policy", href: "https://monitorss.xyz/legal/cookie" },
  { label: "Support", href: "https://discord.gg/pudv7Rx" },
];

export const AppLegalFooter = () => {
  const { pathname } = useLocation();
  const currentYear = new Date().getFullYear();

  // The message builder is intentionally full-screen and chrome-free.
  if (pathname.endsWith("/message-builder")) {
    return null;
  }

  // Hosted legal boilerplate only applies to the official hosts; a self-hosted
  // instance's users are bound by its operator's terms, not ours.
  if (!isOfficialMonitoRSSHost(window.location.hostname)) {
    return null;
  }

  if (Date.now() < LEGAL_IDENTITY_EFFECTIVE_AT.getTime()) {
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
