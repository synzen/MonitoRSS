import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Icon,
  Input,
  Link,
  Separator,
  Spinner,
  Stack,
  Text,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowUp, FaUpRightFromSquare } from "react-icons/fa6";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";
import { useCreateUserFeed, useUserFeeds } from "../../hooks";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";
import { pages, ProductKey } from "../../../../constants";
import { useDiscordUserMe, useUserMe } from "../../../discordUser";
import { PricingDialogContext } from "@/features/subscriptionProducts";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import {
  AccordionRoot,
  AccordionItem,
  AccordionItemTrigger,
  AccordionItemContent,
} from "@/components/ui/accordion";

const formSchema = object({
  title: string().optional(),
  // test url is a string that starts with http
  url: string().required("Feed link is required").matches(/^http/, {
    message: "Must be a valid URL",
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  trigger?: React.ReactElement;
}

const RESOLVABLE_ERRORS: string[] = [
  ApiErrorCode.FEED_REQUEST_FORBIDDEN,
  ApiErrorCode.FEED_REQUEST_TOO_MANY_REQUESTS,
];

export const AddUserFeedDialog = ({ trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    getValues,
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
  });
  const [urlFromForm] = watch(["url"]);
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMe } = useUserMe();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const {
    mutateAsync,
    error: createError,
    reset: resetMutation,
  } = useCreateUserFeed();
  const {
    data: feedUrlValidationData,
    mutateAsync: createUserFeedUrlValidation,
    error: validationError,
    reset: resetValidationMutation,
  } = useCreateUserFeedUrlValidation();
  const navigate = useNavigate();
  const isConfirming = !!feedUrlValidationData?.result.resolvedToUrl;

  const onSubmit = async ({ title, url }: FormData) => {
    if (isSubmitting) {
      return;
    }

    try {
      if (!feedUrlValidationData) {
        const { result } = await createUserFeedUrlValidation({
          details: { url },
        });

        if (result.resolvedToUrl) {
          return;
        }
      }

      const {
        result: { id },
      } = await mutateAsync({
        details: {
          title,
          url: feedUrlValidationData?.result.resolvedToUrl
            ? feedUrlValidationData.result.resolvedToUrl
            : url,
        },
      });

      reset();
      setOpen(false);
      navigate(pages.userFeed(id), {
        state: {
          isNewFeed: true,
        },
      });
    } catch (err) {}
  };

  useEffect(() => {
    reset();
    resetMutation();
    resetValidationMutation();
  }, [open]);

  const error = createError || validationError;
  const canResolveError =
    error?.errorCode && RESOLVABLE_ERRORS.includes(error.errorCode);
  const isRedditConnectionRequired =
    error?.errorCode === ApiErrorCode.REDDIT_CONNECTION_REQUIRED;
  const isAtLimit =
    userFeedsResults &&
    discordUserMe &&
    userFeedsResults?.total >= discordUserMe?.maxUserFeeds;

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, {
          onClick: () => setOpen(true),
        })
      ) : (
        <PrimaryActionButton onClick={() => setOpen(true)} variant="solid">
          <span>
            {t("features.userFeeds.components.addUserFeedDialog.addButton")}
          </span>
        </PrimaryActionButton>
      )}
      <DialogRoot open={open} onOpenChange={(e) => setOpen(e.open)} size="xl">
        <DialogContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader marginRight={4}>
              <DialogTitle>
                {isConfirming
                  ? "Confirm feed link change"
                  : t("features.userFeeds.components.addUserFeedDialog.title")}
              </DialogTitle>
            </DialogHeader>
            <DialogCloseTrigger />
            <DialogBody>
              {isConfirming && (
                <Stack gap={4} role="alert">
                  <Alert
                    status="warning"
                    role={undefined}
                    title="The url you put in did not directly point to a valid feed."
                  />
                  <Stack gap={4} aria-live="polite">
                    <Box>
                      <Text display="inline">We found </Text>
                      <Link
                        display="inline"
                        color="text.link"
                        href={feedUrlValidationData.result.resolvedToUrl || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <HStack alignItems="center" display="inline">
                          <Text wordBreak="break-all" display="inline">
                            {feedUrlValidationData.result.resolvedToUrl}
                          </Text>
                          <Icon as={FaUpRightFromSquare} ml={1} />
                        </HStack>
                      </Link>{" "}
                      <Text display="inline">
                        instead that might be related to the url you provided.
                        Do you want to use this feed link instead?
                      </Text>
                    </Box>
                    <span
                      style={{
                        fontWeight: 600,
                      }}
                    >
                      <Text display="inline">Your original link </Text>
                      <Link
                        display="inline"
                        color="text.link"
                        href={urlFromForm || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        wordBreak="break-all"
                      >
                        {urlFromForm}
                      </Link>
                      <Text display="inline"> will not be used.</Text>
                    </span>
                  </Stack>
                </Stack>
              )}
              {!isConfirming && (
                <Stack gap={4}>
                  <Stack
                    flex={1}
                    gap={4}
                    px={4}
                    py={4}
                    borderStyle="solid"
                    borderWidth={1}
                    borderRadius="l3"
                    borderColor="border"
                    as="aside"
                  >
                    <HStack
                      justifyContent="space-between"
                      alignItems="flex-start"
                      flexWrap="wrap"
                      gap={4}
                      aria-labelledby="limits"
                    >
                      <Heading as="h2" size="md" id="limits">
                        Limits
                      </Heading>
                      <Button
                        variant="outline"
                        onClick={onOpenPricingDialog}
                        size="sm"
                      >
                        <Icon as={FaArrowUp} />
                        Increase Limits
                      </Button>
                    </HStack>
                    <HStack separator={<Separator orientation="vertical" />}>
                      <Stack flex={1}>
                        <Heading as="h3" size="sm" fontWeight="semibold">
                          Feed Limit
                        </Heading>
                        <Text
                          color={isAtLimit ? "text.error" : undefined}
                          hidden={!userFeedsResults || !discordUserMe}
                        >
                          {userFeedsResults?.total}/
                          {discordUserMe?.maxUserFeeds}
                        </Text>
                        <Spinner
                          hidden={!!userFeedsResults && !!discordUserMe}
                          size="sm"
                        />
                      </Stack>
                      <Stack flex={1}>
                        <Heading as="h3" size="sm" fontWeight="semibold">
                          Daily Article Limit Per Feed
                        </Heading>
                        <Text>
                          {userMe &&
                            userMe.result.subscription.product.key !==
                              ProductKey.Free &&
                            1000}
                          {userMe &&
                            userMe.result.subscription.product.key ===
                              ProductKey.Free &&
                            50}
                          {!userMe && <Spinner size="sm" />}
                        </Text>
                      </Stack>
                    </HStack>
                  </Stack>
                  <Field
                    invalid={!!errors.url}
                    required
                    label="Feed Link"
                    helperText="Must be a link to a valid RSS feed, or a page that contains an embedded link to an RSS feed."
                    errorText={errors.url?.message}
                  >
                    <Controller
                      name="url"
                      control={control}
                      render={({ field }) => (
                        <Input
                          readOnly={isSubmitting}
                          {...field}
                          value={field.value || ""}
                          type="url"
                        />
                      )}
                    />
                  </Field>
                  <Field
                    label={t(
                      "features.userFeeds.components.addUserFeedDialog.formTitleLabel",
                    )}
                    helperText="An optional title for your own reference. If left blank, the feed's title will be automatically detected."
                    errorText={errors.title?.message}
                  >
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => (
                        <Input
                          aria-readonly={isSubmitting}
                          {...field}
                          value={field.value || ""}
                        />
                      )}
                    />
                  </Field>
                  <Separator />
                  <Heading
                    as="h2"
                    size="sm"
                    fontWeight="medium"
                    id="faq-accordion"
                  >
                    Frequently Asked Questions
                  </Heading>
                  <AccordionRoot
                    collapsible
                    role="list"
                    aria-labelledby="faq-accordion"
                  >
                    <AccordionItem
                      value="what-is-rss"
                      role="listitem"
                      border="none"
                      borderLeft="solid 1px var(--app-accent-solid)"
                    >
                      <AccordionItemTrigger border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="text.link"
                          alignItems="center"
                          textAlign="left"
                        >
                          What is an RSS feed?
                        </Flex>
                      </AccordionItemTrigger>
                      <AccordionItemContent>
                        <Text fontSize={13}>
                          An RSS feed is a specially-formatted webpage with XML
                          text that&apos;s designed to contain news articles. An
                          example of an RSS feed link is{" "}
                          <Link
                            href="https://www.ign.com/rss/articles/feed"
                            target="_blank"
                            rel="noopener noreferrer"
                            color="text.link"
                          >
                            https://www.ign.com/rss/articles/feed
                          </Link>
                          .
                          <br />
                          <br />
                          To see if a link is a valid RSS feed, you may search
                          for &quot;online feed validators&quot; and input feed
                          URLs to test.
                        </Text>
                      </AccordionItemContent>
                    </AccordionItem>
                    <AccordionItem
                      value="how-to-find-rss"
                      role="listitem"
                      border="none"
                      borderLeft="solid 1px var(--app-accent-solid)"
                    >
                      <AccordionItemTrigger border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="text.link"
                          alignItems="center"
                          textAlign="left"
                        >
                          How do I find RSS feeds?
                        </Flex>
                      </AccordionItemTrigger>
                      <AccordionItemContent>
                        <Text fontSize={13}>
                          You can find RSS feed pages by searching for what
                          you&apos;re looking for, plus &quot;RSS feed&quot;,
                          such as &quot;podcast RSS feeds&quot;. You may also
                          contact site owners for links to RSS feeds they may
                          have. An example RSS feed link is{" "}
                          <Link
                            href="https://www.ign.com/rss/articles/feed"
                            target="_blank"
                            rel="noopener noreferrer"
                            color="text.link"
                          >
                            https://www.ign.com/rss/articles/feed
                          </Link>
                          .
                          <br />
                          <br />
                          You may also try submitting links to regular webpages
                          and MonitoRSS will attempt to find RSS feeds related
                          to the webpage.
                        </Text>
                      </AccordionItemContent>
                    </AccordionItem>
                    <AccordionItem
                      value="when-articles-delivered"
                      role="listitem"
                      border="none"
                      borderLeft="solid 1px var(--app-accent-solid)"
                    >
                      <AccordionItemTrigger border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="text.link"
                          alignItems="center"
                          textAlign="left"
                        >
                          When do new articles get delivered?
                        </Flex>
                      </AccordionItemTrigger>
                      <AccordionItemContent>
                        <Text fontSize={13}>
                          With RSS, article delivery is not instant. New
                          articles are checked on a regular interval (every 20
                          minutes by default for free). Once new articles are
                          found, they are automatically delivered.
                        </Text>
                      </AccordionItemContent>
                    </AccordionItem>
                  </AccordionRoot>
                  {error && !isRedditConnectionRequired && (
                    <InlineErrorAlert
                      title="Failed to add feed"
                      description={
                        error.errorCode === ApiErrorCode.FEED_LIMIT_REACHED ? (
                          <Stack>
                            <Text>
                              You&apos;ve reached your feed limit. Consider
                              supporting MonitoRSS&apos;s open-source
                              development by upgrading your plan and increasing
                              your feed limit.
                            </Text>
                            <Box>
                              <Button onClick={onOpenPricingDialog}>
                                <Icon as={FaArrowUp} />
                                Upgrade Plan
                              </Button>
                            </Box>
                          </Stack>
                        ) : (
                          <Stack>
                            <Text>{error.message}</Text>
                          </Stack>
                        )
                      }
                    />
                  )}
                  {canResolveError && (
                    <FixFeedRequestsCTA
                      url={getValues().url}
                      onCorrected={() => onSubmit(getValues())}
                    />
                  )}
                  {isRedditConnectionRequired && (
                    <FixFeedRequestsCTA
                      url={getValues().url}
                      variant="required"
                      onCorrected={() => onSubmit(getValues())}
                    />
                  )}
                </Stack>
              )}
            </DialogBody>
            <DialogFooter>
              <Button
                variant="ghost"
                mr={3}
                onClick={() => {
                  if (isSubmitting) {
                    return;
                  }

                  if (isConfirming) {
                    reset();
                    resetValidationMutation();
                  } else {
                    setOpen(false);
                  }
                }}
                aria-disabled={isSubmitting}
              >
                <span>
                  {isConfirming ? "Go back" : t("common.buttons.cancel")}
                </span>
              </Button>
              <PrimaryActionButton type="submit" disabled={isSubmitting}>
                <span>{isSubmitting && "Saving..."}</span>
                <span>
                  {!isSubmitting &&
                    isConfirming &&
                    "Add feed with updated link"}
                </span>
                <span>{!isSubmitting && !isConfirming && "Save"}</span>
              </PrimaryActionButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </DialogRoot>
    </>
  );
};
