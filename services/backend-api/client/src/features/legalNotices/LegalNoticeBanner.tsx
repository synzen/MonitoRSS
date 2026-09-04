import { Alert, Link, VisuallyHidden } from "@chakra-ui/react";
import { Fragment } from "react";
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
          <span>
            {" Please review our "}
            {notice.documents.map((document, index) => (
              <Fragment key={document.type}>
                {index > 0 && (index === notice.documents.length - 1 ? " and " : ", ")}
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
              </Fragment>
            ))}
            .
          </span>
        </Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
};
