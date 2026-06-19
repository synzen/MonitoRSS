import { Flex, Link } from "@chakra-ui/react";
import { useLocation } from "react-router-dom";

/**
 * Persistent app-shell footer rendered below page content on every route.
 * Surfaces the Privacy Policy and Terms so they are reachable from anywhere,
 * not just from inside billing dialogs (GDPR transparency).
 *
 * Hidden on the message builder, which is intentionally full-screen and
 * chrome-free (no header either), so the footer never intrudes on it.
 */
export const AppFooter = () => {
  const { pathname } = useLocation();

  if (pathname.endsWith("/message-builder")) {
    return null;
  }

  return (
    <Flex
      as="footer"
      flexShrink={0}
      justifyContent="center"
      gap={6}
      py={3}
      px={6}
      borderTopWidth="1px"
      fontSize="sm"
      color="fg.muted"
    >
      <Link
        href="https://monitorss.xyz/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        color="text.link"
      >
        Privacy Policy
      </Link>
      <Link
        href="https://monitorss.xyz/terms"
        target="_blank"
        rel="noopener noreferrer"
        color="text.link"
      >
        Terms
      </Link>
    </Flex>
  );
};
