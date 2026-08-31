import { Box, Flex, Link, Text } from "@chakra-ui/react";
import { isOfficialMonitoRSSHost } from "./constants";

const links = [
  { label: "Terms", href: "https://monitorss.xyz/terms" },
  { label: "Privacy", href: "https://monitorss.xyz/privacy-policy" },
  { label: "Cookie Policy", href: "https://monitorss.xyz/cookie-policy" },
  { label: "Support", href: "https://discord.gg/pudv7Rx" },
];

export const AppLegalFooter = () =>
  !isOfficialMonitoRSSHost(window.location.hostname) ? null : (
    <Box as="footer" mt="auto" width="100%" borderTopWidth="1px" borderColor="border" bg="bg.panel">
      <Flex
        maxW="7xl"
        mx="auto"
        px={{ base: "4", md: "8" }}
        py="3"
        gap="4"
        align="center"
        justify="space-between"
        flexWrap="wrap"
      >
        <Text fontSize="sm" color="fg.muted">
          MonitoRSS
        </Text>
        <Flex gap="3" flexWrap="wrap">
          {links.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer"
              fontSize="sm"
              color="fg.muted"
            >
              {label}
            </Link>
          ))}
        </Flex>
      </Flex>
    </Box>
  );
