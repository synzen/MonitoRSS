import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { yupResolver } from "@hookform/resolvers/yup";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { InferType, object, string } from "yup";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useCreateUserFeed, useUserFeeds } from "../../hooks";
import { notifyError } from "@/utils/notifyError";
import { useDiscordUserMe } from "../../../discordUser";
import { notifySuccess } from "../../../../utils/notifySuccess";
import { pages } from "../../../../constants";
import getChakraColor from "../../../../utils/getChakraColor";

const formSchema = object({
  title: string().required(),
  url: string().url().required(),
});

type FormData = InferType<typeof formSchema>;

export const AddUserFeedDialog = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: { isDirty, errors, isSubmitting },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
  });
  const { mutateAsync } = useCreateUserFeed();
  const { data: discordUserMe, status: discordUserStatus } = useDiscordUserMe();
  const { data: userFeeds, status: userFeedsStatus } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const navigate = useNavigate();
  const initialFocusRef = useRef<HTMLInputElement>(null);

  const onSubmit = async ({ title, url }: FormData) => {
    try {
      const result = await mutateAsync({
        details: {
          title,
          url,
        },
      });

      reset();
      onClose();
      notifySuccess(t("features.userFeeds.components.addUserFeedDialog.successAdd"));
      navigate(pages.userFeed(result.result.id));
    } catch (err) {
      notifyError(t("features.feed.components.addFeedDialog.failedToAdd"), err as Error);
    }
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  const totalFeeds = userFeeds?.total;

  const isUnderLimit =
    totalFeeds !== undefined &&
    discordUserMe?.maxUserFeeds !== undefined &&
    totalFeeds < discordUserMe.maxUserFeeds;

  const isLoading = discordUserStatus === "loading" || userFeedsStatus === "loading";

  return (
    <>
      <Tooltip
        label={t("features.userFeeds.components.addUserFeedDialog.overLimitHint")}
        hidden={isUnderLimit === true}
      >
        <Button
          colorScheme="blue"
          onClick={onOpen}
          isDisabled={!isUnderLimit}
          isLoading={isLoading}
          variant="solid"
        >
          {t("features.userFeeds.components.addUserFeedDialog.addButton")}
        </Button>
      </Tooltip>
      <Modal isOpen={isOpen} onClose={onClose} size="xl" initialFocusRef={initialFocusRef}>
        <ModalOverlay />
        <ModalContent>
          <form onSubmit={handleSubmit(onSubmit)}>
            <ModalHeader>{t("features.userFeeds.components.addUserFeedDialog.title")}</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.title}>
                  <FormLabel>
                    {t("features.userFeeds.components.addUserFeedDialog.formTitleLabel")}
                  </FormLabel>
                  <Controller
                    name="title"
                    control={control}
                    render={({ field }) => (
                      <Input
                        isDisabled={isSubmitting}
                        {...field}
                        value={field.value || ""}
                        ref={initialFocusRef}
                      />
                    )}
                  />
                  <FormHelperText>
                    {t("features.userFeeds.components.addUserFeedDialog.onlyForYourReferenceLabel")}
                  </FormHelperText>
                  <FormErrorMessage>{errors.title?.message}</FormErrorMessage>
                </FormControl>
                <FormControl isInvalid={!!errors.url}>
                  <FormLabel>RSS Feed Link</FormLabel>
                  <Controller
                    name="url"
                    control={control}
                    render={({ field }) => (
                      <Input isDisabled={isSubmitting} {...field} value={field.value || ""} />
                    )}
                  />
                  <FormHelperText>
                    Must be a valid RSS feed. To check if a link is a valid feed, you may search for
                    online feed validators.
                  </FormHelperText>
                  <FormErrorMessage>{errors.url?.message}</FormErrorMessage>
                </FormControl>
                <Accordion allowToggle>
                  <AccordionItem
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
                        An RSS feed is not any regular web page - it is a specially-formatted
                        webpage with XML text that&apos;s designed to contain news articles.
                        <br />
                        <br />
                        You can usually find RSS feed pages by searching for the name of the site
                        plus &quot;RSS feed&quot;. For example, an RSS feed link that is for IGN
                        game reviews is{" "}
                        <Text as="code">http://feeds.feedburner.com/ign/game-reviews</Text>.
                        <br />
                        <br />
                        To see if a link is a valid RSS feed, you may search for &quot;online feed
                        validators&quot; and input feed URLs to test.
                      </Text>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>
              </Stack>
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onClose} isDisabled={isSubmitting}>
                {t("common.buttons.cancel")}
              </Button>
              <Button
                colorScheme="blue"
                type="submit"
                isLoading={isSubmitting}
                isDisabled={!isDirty || isSubmitting}
              >
                {t("common.buttons.save")}
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
};
