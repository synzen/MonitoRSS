import { Box, Flex, Link, Text, chakra } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";
import { BOX_CONSTRAINED_MAX_WIDTH, BOX_CONSTRAINED_PADDING_X } from "../BoxConstrainedWidth";
import { isOfficialMonitoRSSHost, LEGAL_IDENTITY_EFFECTIVE_AT } from "./constants";
import { openConsentPreferences } from "../../utils/consentPreferences";

const currentLinks = [
  { label: "Terms", href: "https://monitorss.xyz/terms" },
  { label: "Privacy", href: "https://monitorss.xyz/privacy-policy" },
  { label: "Cookie Policy", href: "https://monitorss.xyz/cookie-policy" },
  { label: "Support", href: "https://discord.gg/pudv7Rx" },
];

const updatedLinks = [
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
  // instance's users are bound by its operator's terms, not ours. Local dev
  // servers bypass for preview.
  const isDevPreview =
    import.meta.env.MODE === "development" || import.meta.env.MODE === "development-mockapi";

  if (!isOfficialMonitoRSSHost(window.location.hostname) && !isDevPreview) {
    return null;
  }

  // Only the Relayvale identity is effective-dated. Consent machinery and
  // current-doc links ship immediately since replay runs today.
  const relayvaleEffective = Date.now() >= LEGAL_IDENTITY_EFFECTIVE_AT.getTime();
  const links = relayvaleEffective ? updatedLinks : currentLinks;

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
          {relayvaleEffective ? (
            <Text fontSize="sm" color="fg.muted">
              © {currentYear} Relayvale LLC
            </Text>
          ) : null}
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
