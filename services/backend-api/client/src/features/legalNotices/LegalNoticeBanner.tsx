import { Alert, Link, Wrap } from "@chakra-ui/react";
import { useDiscordAuthStatus } from "@/features/discordUser";
import {
  isProductionDashboardHostname,
  useApplicableLegalNotice,
} from "./hooks";

const DOCUMENT_LABELS = {
  terms: "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
} as const;

export const LegalNoticeBanner = () => {
  const { data: authStatus } = useDiscordAuthStatus();
  const shouldRequest =
    !!authStatus?.authenticated && isProductionDashboardHostname(window.location.hostname);
  const { data } = useApplicableLegalNotice({ enabled: shouldRequest });
  const notice = data?.result;

  if (!notice) {
    return null;
  }

  return (
    <Alert.Root status="info" role="status" aria-label="Legal notice" borderRadius={0}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Legal document update</Alert.Title>
        <Alert.Description>
          <Wrap gapX={1} gapY={0} align="baseline">
            <span>{notice.summary}</span>
            {notice.documents.map((document) => (
              <Link
                key={document.type}
                href={document.url}
                target="_blank"
                rel="noreferrer"
                color="text.link"
                textDecoration="underline"
              >
                {DOCUMENT_LABELS[document.type]}
              </Link>
            ))}
          </Wrap>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
