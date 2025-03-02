import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Alert,
  AlertIcon,
  AlertTitle,
  Button,
  Divider,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Heading,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Spinner,
  Stack,
  StackDivider,
  Text,
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@chakra-ui/icons";
import { useCreateUserFeed, useUserFeeds } from "../../hooks";
import { notifySuccess } from "../../../../utils/notifySuccess";
import getChakraColor from "../../../../utils/getChakraColor";
import { InlineErrorAlert } from "../../../../components/InlineErrorAlert";
import { FixFeedRequestsCTA } from "../FixFeedRequestsCTA";
import { ApiErrorCode } from "../../../../utils/getStandardErrorCodeMessage copy";
import { useCreateUserFeedUrlValidation } from "../../hooks/useCreateUserFeedUrlValidation";
import { pages, ProductKey } from "../../../../constants";
import { useDiscordUserMe, useUserMe } from "../../../discordUser";
import { PricingDialogContext } from "../../../../contexts";

const formSchema = object({
  title: string().optional(),
  // test url is a string that starts with http
  url: string().required().matches(/^http/, {
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
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
  });
  const { data: discordUserMe } = useDiscordUserMe();
  const { data: userMe } = useUserMe();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { onOpen: onOpenPricingDialog } = useContext(PricingDialogContext);
  const { mutateAsync, error: createError, reset: resetMutation } = useCreateUserFeed();
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
        const { result } = await createUserFeedUrlValidation({ details: { url } });

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
      onClose();
      notifySuccess(t("features.userFeeds.components.addUserFeedDialog.successAdd"));
      navigate(pages.userFeed(id));
    } catch (err) {}
  };

  useEffect(() => {
    reset();
    resetMutation();
    resetValidationMutation();
  }, [isOpen]);

  const error = createError || validationError;
  const canResolveError = error?.errorCode && RESOLVABLE_ERRORS.includes(error.errorCode);

  return (
    <>
      {trigger ? (
        React.cloneElement(trigger, {
          onClick: onOpen,
        })
      ) : (
        <Button colorScheme="blue" onClick={() => onOpen()} variant="solid">
          <span>{t("features.userFeeds.components.addUserFeedDialog.addButton")}</span>
        </Button>
      )}
      <Modal isOpen={isOpen} onClose={onClose} size="xl">
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>
              {isConfirming
                ? "Confirm feed addition"
                : t("features.userFeeds.components.addUserFeedDialog.title")}
            </ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {isConfirming && (
                <Stack spacing={4} role="alert">
                  <Alert status="warning" role={undefined}>
                    <AlertIcon />
                    <AlertTitle>
                      The url you put in did not directly point to a valid feed!
                    </AlertTitle>
                  </Alert>
                  <Stack spacing={4} aria-live="polite">
                    <Text>
                      We found a feed URL that might be related to the url you provided. Do you want
                      to add the URL below instead?
                    </Text>
                    <FormControl>
                      <FormLabel>Updated Feed URL</FormLabel>
                      <Input
                        isReadOnly
                        bg="gray.800"
                        value={feedUrlValidationData.result.resolvedToUrl || ""}
                      />
                    </FormControl>
                  </Stack>
                </Stack>
              )}
              {!isConfirming && (
                <Stack spacing={4}>
                  <Stack
                    flex={1}
                    spacing={4}
                    px={4}
                    py={4}
                    borderStyle="solid"
                    borderWidth={1}
                    borderRadius="md"
                    borderColor="gray.600"
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
                        leftIcon={<ArrowLeftIcon transform="rotate(90deg)" />}
                        onClick={onOpenPricingDialog}
                        size="sm"
                      >
                        Increase Limits
                      </Button>
                    </HStack>
                    <HStack divider={<StackDivider />}>
                      <Stack flex={1}>
                        <Heading as="h3" size="sm" fontWeight="semibold">
                          Feed Limit
                        </Heading>
                        {userFeedsResults && discordUserMe && (
                          <Text>
                            {userFeedsResults.total}/{discordUserMe.maxUserFeeds}
                          </Text>
                        )}
                        {(!userFeedsResults || !discordUserMe) && <Spinner size="sm" />}
                      </Stack>
                      <Stack flex={1}>
                        <Heading as="h3" size="sm" fontWeight="semibold">
                          Daily Feed Article Limit
                        </Heading>
                        <Text>
                          {userMe &&
                            userMe.result.subscription.product.key !== ProductKey.Free &&
                            1000}
                          {userMe &&
                            userMe.result.subscription.product.key === ProductKey.Free &&
                            50}
                          {!userMe && <Spinner size="sm" />}
                        </Text>
                      </Stack>
                    </HStack>
                  </Stack>
                  <FormControl isInvalid={!!errors.url} isRequired>
                    <FormLabel>Feed Link</FormLabel>
                    <Controller
                      name="url"
                      control={control}
                      render={({ field }) => (
                        <Input
                          isReadOnly={isSubmitting}
                          {...field}
                          value={field.value || ""}
                          bg="gray.800"
                          type="url"
                        />
                      )}
                    />
                    <FormHelperText>
                      Must be a link to a valid RSS feed, or a page that contains an embedded link
                      to an RSS feed.
                    </FormHelperText>
                    <FormErrorMessage>{errors.url?.message}</FormErrorMessage>
                  </FormControl>
                  <FormControl>
                    <FormLabel>
                      {t("features.userFeeds.components.addUserFeedDialog.formTitleLabel")}
                    </FormLabel>
                    <Controller
                      name="title"
                      control={control}
                      render={({ field }) => (
                        <Input
                          aria-readonly={isSubmitting}
                          {...field}
                          value={field.value || ""}
                          bg="gray.800"
                        />
                      )}
                    />
                    <FormHelperText>
                      An optional title for your own reference. If left blank, the feed&apos;s title
                      will be automatically detected.
                    </FormHelperText>
                    <FormErrorMessage>{errors.title?.message}</FormErrorMessage>
                  </FormControl>
                  <Divider />
                  <Heading as="h2" size="sm" fontWeight="medium" id="faq-accordion">
                    Frequently Asked Questions
                  </Heading>
                  <Accordion allowToggle role="list" aria-labelledby="faq-accordion">
                    <AccordionItem
                      role="listitem"
                      border="none"
                      borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                    >
                      <AccordionButton border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="blue.200"
                          alignItems="center"
                          textAlign="left"
                        >
                          What is an RSS feed?
                          <AccordionIcon />
                        </Flex>
                      </AccordionButton>
                      <AccordionPanel>
                        <Text fontSize={13}>
                          An RSS feed is a specially-formatted webpage with XML text that&apos;s
                          designed to contain news articles. An example of an RSS feed link is{" "}
                          <Text as="code">http://feeds.feedburner.com/ign/game-reviews</Text>.
                          <br />
                          <br />
                          To see if a link is a valid RSS feed, you may search for &quot;online feed
                          validators&quot; and input feed URLs to test.
                        </Text>
                      </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem
                      role="listitem"
                      border="none"
                      borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                    >
                      <AccordionButton border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="blue.200"
                          alignItems="center"
                          textAlign="left"
                        >
                          How do I find RSS feeds?
                          <AccordionIcon />
                        </Flex>
                      </AccordionButton>
                      <AccordionPanel>
                        <Text fontSize={13}>
                          You can find RSS feed pages by searching for what you&apos;re looking for,
                          plus &quot;RSS feed&quot;, such as &quot;podcast RSS feeds&quot;. You may
                          also contact site owners for links to RSS feeds they may have. An example
                          RSS feed link is{" "}
                          <Text as="code">http://feeds.feedburner.com/ign/game-reviews</Text>.
                          <br />
                          <br />
                          You may also try submitting links to regular webpages and MonitoRSS will
                          attempt to find RSS feeds related to the webpage.
                        </Text>
                      </AccordionPanel>
                    </AccordionItem>
                    <AccordionItem
                      role="listitem"
                      border="none"
                      borderLeft={`solid 1px ${getChakraColor("blue.200")}`}
                    >
                      <AccordionButton border="none">
                        <Flex
                          flex="1"
                          gap={4}
                          fontSize={13}
                          color="blue.200"
                          alignItems="center"
                          textAlign="left"
                        >
                          When do new articles get delivered?
                          <AccordionIcon />
                        </Flex>
                      </AccordionButton>
                      <AccordionPanel>
                        <Text fontSize={13}>
                          With RSS, article delivery is not instant. New articles are checked on a
                          regular interval (every 10 minutes by default for free). Once new articles
                          are found, they are automatically delivered.
                        </Text>
                      </AccordionPanel>
                    </AccordionItem>
                  </Accordion>
                  {error && (
                    <InlineErrorAlert
                      title="Failed to add feed"
                      description={
                        <Stack>
                          <Text>{error.message}</Text>
                        </Stack>
                      }
                    />
                  )}
                  {canResolveError && (
                    <FixFeedRequestsCTA
                      url={getValues().url}
                      onCorrected={() => onSubmit(getValues())}
                    />
                  )}
                </Stack>
              )}
            </ModalBody>
            <ModalFooter>
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
                    onClose();
                  }
                }}
                aria-disabled={isSubmitting}
              >
                <span>{isConfirming ? "Go back" : t("common.buttons.cancel")}</span>
              </Button>
              <Button colorScheme="blue" type="submit" aria-disabled={isSubmitting}>
                <span>{isSubmitting && "Saving..."}</span>
                <span>{!isSubmitting && isConfirming && "Add feed with updated url"}</span>
                <span>{!isSubmitting && !isConfirming && "Save"}</span>
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};
