import { Alert, Link, List, VisuallyHidden } from "@chakra-ui/react";
import { useDiscordAuthStatus } from "@/features/discordUser";
import { useApplicableLegalNotice } from "./hooks";

const DOCUMENT_LABELS = {
  terms: "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
} as const;

export const LegalNoticeBanner = () => {
  const { data: authStatus } = useDiscordAuthStatus();
  const { data } = useApplicableLegalNotice({
    enabled: !!authStatus?.authenticated,
  });
  const notice = data?.result;

  if (!notice) {
    return null;
  }

  return (
    <Alert.Root status="info" role="status" aria-label="Legal notice" borderRadius={0}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Updates to our Terms and Privacy Policy</Alert.Title>
        <Alert.Description>
          <span>{notice.summary}</span>
          <List.Root listStyleType="none" margin={0} display="flex" gap={1} flexWrap="wrap">
            <List.Item>Review:</List.Item>
            {notice.documents.map((document) => (
              <List.Item key={document.type}>
                <Link
                  href={document.url}
                  target="_blank"
                  rel="noreferrer"
                  color="text.link"
                  textDecoration="underline"
                >
                  {DOCUMENT_LABELS[document.type]}
                  <VisuallyHidden> (opens in a new tab)</VisuallyHidden>
                </Link>
              </List.Item>
            ))}
          </List.Root>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
