import { Box, Flex, Link, Text, chakra } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import { BOX_CONSTRAINED_MAX_WIDTH, BOX_CONSTRAINED_PADDING_X } from "../BoxConstrainedWidth";
import { isOfficialMonitoRSSHost, LEGAL_IDENTITY_EFFECTIVE_AT } from "./constants";
import { openConsentPreferences } from "../../utils/consentPreferences";

const links = [
  { label: "Terms", href: "https://monitorss.xyz/terms" },
  { label: "Privacy", href: "https://monitorss.xyz/privacy-policy" },
  { label: "Cookie Policy", href: "https://monitorss.xyz/cookie-policy" },
  { label: "Support", href: "https://discord.gg/pudv7Rx" },
];

export const AppLegalFooter = () => {
  const { pathname } = useLocation();

  // The message builder is intentionally full-screen and chrome-free.
  if (pathname.endsWith("/message-builder")) {
    return null;
  }

  // Hosted legal boilerplate only applies to the official hosts; a self-hosted
  // instance's users are bound by its operator's terms, not ours. Local dev
  // servers bypass for preview.
  const isDevPreview =
    import.meta.env.MODE === "development" || import.meta.env.MODE === "development-mockapi";

  if (!isOfficialMonitoRSSHost(window.location.hostname) && !isDevPreview) {
    return null;
  }

  return (
    <Box
      as="footer"
      width="100%"
      marginTop={6}
      borderTopWidth="1px"
      borderColor="border"
    >
      <Flex
        maxWidth={BOX_CONSTRAINED_MAX_WIDTH}
        mx="auto"
        paddingX={BOX_CONSTRAINED_PADDING_X}
        py="3"
        gap="4"
        align={{ base: "flex-start", md: "center" }}
        justify="space-between"
        flexDir={{ base: "column-reverse", md: "row" }}
      >
        <Box>
          <Text fontSize="sm" color="fg.muted">
            MonitoRSS
          </Text>
          {Date.now() >= LEGAL_IDENTITY_EFFECTIVE_AT.getTime() && (
            <Text fontSize="xs" color="fg.subtle">
              Relayvale LLC
            </Text>
          )}
        </Box>
        <Flex as="nav" aria-label="Legal" gap="3" flexWrap="wrap" align="center">
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
          <chakra.button
            type="button"
            onClick={openConsentPreferences}
            fontSize="sm"
            color="fg.muted"
            cursor="pointer"
            _hover={{ textDecoration: "underline" }}
          >
            Consent Preferences
          </chakra.button>
        </Flex>
      </Flex>
    </Box>
  );
};
