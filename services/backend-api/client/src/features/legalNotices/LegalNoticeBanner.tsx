import { Alert, Link, VisuallyHidden } from "@chakra-ui/react";
import { Fragment } from "react";
import { SafeLoadingButton } from "@/components/SafeLoadingButton";
import { useDiscordAuthStatus } from "@/features/discordUser";
import { useApplicableLegalNotice, useDismissLegalNotice } from "./hooks";

const DOCUMENT_LABELS = {
  terms: "Terms and Conditions",
  "privacy-policy": "Privacy Policy",
} as const;

export const LegalNoticeBanner = () => {
  const { data: authStatus } = useDiscordAuthStatus();
  const { data } = useApplicableLegalNotice({
    enabled: !!authStatus?.authenticated,
  });
  const dismissal = useDismissLegalNotice();
  const notice = data?.result;

  if (!notice) {
    return null;
  }

  return (
    <Alert.Root status="info" role="status" aria-label="Legal notice" borderRadius={0}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>
          {notice.phase === "upcoming"
            ? "Upcoming updates to our Terms and Privacy Policy"
            : "Updates to our Terms and Privacy Policy"}
        </Alert.Title>
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
        <SafeLoadingButton
          alignSelf="flex-start"
          mt={2}
          size="sm"
          aria-label="Dismiss legal notice"
          loading={dismissal.status === "loading"}
          onClick={() => dismissal.mutate(notice.version)}
        >
          Dismiss
        </SafeLoadingButton>
      </Alert.Content>
    </Alert.Root>
  );
};
