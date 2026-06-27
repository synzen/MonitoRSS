import { useSearchParams } from "react-router-dom";
import { FaCircleCheck, FaTriangleExclamation } from "react-icons/fa6";
import { Button, Heading, Icon, Stack, Text } from "@chakra-ui/react";
import { useRevertEmailVerification } from "@/features/workspaces";
import { InlineErrorAlert } from "@/components/InlineErrorAlert";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { getStandardErrorCodeMessage, ApiErrorCode } from "@/utils/getStandardErrorCodeMessage";
import { pages } from "../constants";

/**
 * Lands the "this wasn't me, revert" link from the verified-email-changed
 * notice. Public (the recipient may not be signed in) and authorized solely by
 * the signed token in the query string. The revert is a deliberate click, never
 * an action on page load, so email scanners or link prefetchers can't trigger
 * the session-invalidating change.
 */
export const RevertVerifiedEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { mutateAsync, status, error } = useRevertEmailVerification();

  if (!token) {
    return (
      <CenteredMessage
        icon={<FaTriangleExclamation />}
        iconColor="text.warning"
        title="This link is invalid"
        description="The revert link is missing its token. It may have been altered when your email client opened it."
      />
    );
  }

  if (status === "success") {
    return (
      <CenteredMessage
        icon={<FaCircleCheck />}
        iconColor="text.success"
        title="Your email change was reverted"
        description="The verified email has been restored and all sessions on the account were signed out. Sign in again to continue."
      >
        <Button asChild mt={4}>
          <a href={pages.userFeeds()}>Go to MonitoRSS</a>
        </Button>
      </CenteredMessage>
    );
  }

  const onRevert = async () => {
    try {
      await mutateAsync({ details: { token } });
    } catch {
      // Surfaced via the error state below.
    }
  };

  return (
    <CenteredMessage
      icon={<FaTriangleExclamation />}
      iconColor="text.warning"
      title="Revert this email change?"
      description="This restores the previous verified email on the account and signs out every active session. Do this if you did not make the change."
    >
      <Stack gap="4" alignItems="center" mt={2}>
        {error && (
          <InlineErrorAlert
            title="Could not revert the change"
            description={
              error.errorCode
                ? getStandardErrorCodeMessage(error.errorCode as ApiErrorCode)
                : error.message
            }
          />
        )}
        <PrimaryActionButton
          onClick={onRevert}
          loading={status === "loading"}
          loadingText="Reverting"
        >
          Revert this change
        </PrimaryActionButton>
      </Stack>
    </CenteredMessage>
  );
};

const CenteredMessage = ({
  icon,
  iconColor,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  iconColor: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) => (
  <Stack
    display="flex"
    flexDir="column"
    alignItems="center"
    justifyContent="center"
    height="100%"
    paddingBottom="10rem"
    textAlign="center"
    paddingX="12"
    gap="6"
  >
    <Stack display="flex" justifyContent="center" alignItems="center" gap="4" maxW="lg">
      <Icon fontSize="6rem" color={iconColor}>
        {icon}
      </Icon>
      <Heading size="xl">{title}</Heading>
      <Text fontSize="lg">{description}</Text>
      {children}
    </Stack>
  </Stack>
);
