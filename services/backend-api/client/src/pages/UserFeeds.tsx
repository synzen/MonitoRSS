import {
  Flex,
  Heading,
  Box,
  HStack,
  Text,
  Stack,
  Button,
  Link as ChakraLink,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  Center,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuDivider,
  IconButton,
} from "@chakra-ui/react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AddIcon, ChevronDownIcon, DeleteIcon } from "@chakra-ui/icons";
import { useCallback, useContext, useEffect } from "react";
import { FaRegNewspaper } from "react-icons/fa6";
import { FaPause, FaPlay } from "react-icons/fa";
import { useUserMe } from "../features/discordUser";
import {
  AddUserFeedDialog,
  FeedManagementInvitesDialog,
  useDeleteUserFeeds,
  useDisableUserFeeds,
  useEnableUserFeeds,
  UserFeedComputedStatus,
  UserFeedDisabledCode,
  UserFeedsTable,
  useUserFeedManagementInvitesCount,
  useUserFeeds,
} from "../features/feed";
import { pages } from "../constants";
import { BoxConstrained, ConfirmModal } from "../components";
import { UserFeedStatusFilterContext } from "../contexts";
import { useMultiSelectUserFeedContext } from "../contexts/MultiSelectUserFeedContext";
import {
  PageAlertContextOutlet,
  PageAlertProvider,
  usePageAlertContext,
} from "../contexts/PageAlertContext";

export const UserFeeds = () => {
  return (
    <BoxConstrained.Wrapper justifyContent="flex-start" height="100%" overflow="visible">
      <BoxConstrained.Container spacing={6} height="100%">
        <PageAlertProvider>
          <UserFeedsInner />
        </PageAlertProvider>
      </BoxConstrained.Container>
    </BoxConstrained.Wrapper>
  );
};

const UserFeedsInner: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { state } = useLocation();
  const { data: userMeData } = useUserMe();
  const { data: userFeedsRequireAttentionResults } = useUserFeeds({
    limit: 1,
    offset: 0,
    filters: {
      computedStatuses: [UserFeedComputedStatus.RequiresAttention],
    },
  });
  const { data: managementInvitesCount } = useUserFeedManagementInvitesCount();
  const { data: userFeedsResults } = useUserFeeds({
    limit: 1,
    offset: 0,
  });
  const { statusFilters, setStatusFilters } = useContext(UserFeedStatusFilterContext);
  const { selectedFeeds, clearSelection } = useMultiSelectUserFeedContext();
  const { mutateAsync: enableUserFeeds } = useEnableUserFeeds();
  const { mutateAsync: disableUserFeeds } = useDisableUserFeeds();
  const { mutateAsync: deleteUserFeeds } = useDeleteUserFeeds();
  const { createSuccessAlert, createErrorAlert, createInfoAlert } = usePageAlertContext();
  const totalFeedCount = userFeedsResults?.total;
  const navigatedAlertTitle = state?.alertTitle;

  useEffect(() => {
    if (navigatedAlertTitle) {
      createSuccessAlert({
        title: navigatedAlertTitle,
      });
    }
  }, [navigatedAlertTitle]);

  const onApplyRequiresAttentionFilters = useCallback(() => {
    if (
      statusFilters.length === 1 &&
      statusFilters.includes(UserFeedComputedStatus.RequiresAttention)
    ) {
      createInfoAlert({
        title: "You are already viewing feeds that require your attention.",
      });
    } else {
      createSuccessAlert({
        title: `Successfully applied filters. You are now viewing feeds that require your attention.`,
      });
      setStatusFilters([UserFeedComputedStatus.RequiresAttention]);
    }
  }, [statusFilters, setStatusFilters]);

  const hasFailedFeedAlertsDisabled =
    userMeData && !userMeData.result?.preferences?.alertOnDisabledFeeds;

  const onEnableSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await enableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();

      createSuccessAlert({
        title: "Successfully enabled feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to enable feeds.",
        description: (err as Error).message,
      });
    }
  };

  const onDisableSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await disableUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();

      createSuccessAlert({
        title: "Successfully disabled feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to disable feeds.",
        description: (err as Error).message,
      });
    }
  };

  const onDeleteSelectedFeeds = async () => {
    const feedIds = selectedFeeds.map((f) => f.id);

    try {
      await deleteUserFeeds({
        data: {
          feeds: feedIds.map((id) => ({ id })),
        },
      });
      clearSelection();
      createSuccessAlert({
        title: "Successfully deleted feeds.",
      });
    } catch (err) {
      createErrorAlert({
        title: "Failed to delete feeds.",
        description: (err as Error).message,
      });
    }
  };

  const totalFeedsRequiringAttention = userFeedsRequireAttentionResults?.total || 0;
  const totalManagementInvites = managementInvitesCount?.total || 0;

  return (
    <>
      <Stack spacing={4}>
        {!userMeData?.result.migratedToPersonalFeeds && (
          <Button marginTop={2} variant="outline" onClick={() => navigate("/")} size="sm">
            Back to legacy feeds
          </Button>
        )}
        <Stack spacing={2}>
          <PageAlertContextOutlet />
          {totalFeedsRequiringAttention !== undefined && totalFeedsRequiringAttention > 0 && (
            <Alert status="warning" mt={2}>
              <AlertIcon />
              <Box>
                <AlertTitle>
                  {totalFeedsRequiringAttention} feed
                  {totalFeedsRequiringAttention > 1 ? "s" : ""} require
                  {totalFeedsRequiringAttention > 1 ? "" : "s"} your attention!
                </AlertTitle>
                <AlertDescription>
                  Article delivery may be fully or partially paused.{" "}
                  <ChakraLink
                    textAlign="left"
                    as="button"
                    color="blue.300"
                    onClick={onApplyRequiresAttentionFilters}
                  >
                    Click here to apply filters and see which ones they are.
                  </ChakraLink>
                  {hasFailedFeedAlertsDisabled && (
                    <>
                      {" "}
                      You can also{" "}
                      <ChakraLink as={Link} to={pages.userSettings()} color="blue.300">
                        get notified when failures occur
                      </ChakraLink>
                      .
                    </>
                  )}
                </AlertDescription>
              </Box>
            </Alert>
          )}
          <Alert hidden={!totalManagementInvites} mt={2}>
            <HStack
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={4}
              w="100%"
            >
              <Flex>
                <AlertIcon />
                <AlertTitle flex={1}>
                  You have {totalManagementInvites} pending feed management invites
                </AlertTitle>
              </Flex>
              <AlertDescription>
                <Flex>
                  <FeedManagementInvitesDialog
                    trigger={
                      <Button variant="outline">
                        <span>View pending management invites</span>
                      </Button>
                    }
                  />
                </Flex>
              </AlertDescription>
            </HStack>
          </Alert>
        </Stack>
        <Flex alignItems="center" justifyContent="space-between" gap="4" flexWrap="wrap">
          <Flex alignItems="center" gap={4}>
            <Heading as="h1" size="lg" tabIndex={-1}>
              {t("pages.userFeeds.title")}{" "}
              <span>
                {totalFeedCount !== undefined &&
                  selectedFeeds.length > 0 &&
                  `(${selectedFeeds.length}/${totalFeedCount})`}
              </span>
              <span>
                {totalFeedCount !== undefined && !selectedFeeds.length && `(${totalFeedCount})`}
              </span>
            </Heading>
          </Flex>
          <HStack flexWrap="wrap">
            <Menu>
              <MenuButton
                as={Button}
                rightIcon={<ChevronDownIcon />}
                variant="outline"
                // isDisabled={selectedFeeds.length === 0}
              >
                Feed Actions
              </MenuButton>
              <MenuList zIndex={2}>
                <ConfirmModal
                  trigger={
                    <MenuItem
                      isDisabled={
                        !selectedFeeds.length ||
                        !selectedFeeds.some((f) => f.disabledCode === UserFeedDisabledCode.Manual)
                      }
                      icon={<FaPlay />}
                    >
                      Enable
                    </MenuItem>
                  }
                  title={`Are you sure you want to enable ${selectedFeeds.length} feed(s)?`}
                  description="Only feeds that were manually disabled will be enabled."
                  onConfirm={onEnableSelectedFeeds}
                  colorScheme="blue"
                />
                <ConfirmModal
                  trigger={
                    <MenuItem
                      isDisabled={
                        !selectedFeeds.length || !selectedFeeds.some((r) => !r.disabledCode)
                      }
                      icon={<FaPause />}
                    >
                      Disable
                    </MenuItem>
                  }
                  title={`Are you sure you want to disable ${selectedFeeds.length} feed(s)?`}
                  description="Only feeds that are not currently disabled will be affected."
                  onConfirm={onDisableSelectedFeeds}
                  colorScheme="blue"
                />
                <MenuDivider />
                <ConfirmModal
                  trigger={
                    <MenuItem
                      icon={<DeleteIcon color="red.200" />}
                      isDisabled={!selectedFeeds.length}
                    >
                      <Text color="red.200">Delete</Text>
                    </MenuItem>
                  }
                  title={`Are you sure you want to delete ${selectedFeeds.length} feed(s)?`}
                  description="This action cannot be undone."
                  onConfirm={onDeleteSelectedFeeds}
                  colorScheme="red"
                  okText={t("common.buttons.delete")}
                />
              </MenuList>
            </Menu>
            <HStack gap={1}>
              <AddUserFeedDialog
                trigger={
                  <Button colorScheme="blue" leftIcon={<AddIcon />} borderRightRadius={0}>
                    Add Feed
                  </Button>
                }
              />
              <Menu>
                <MenuButton
                  as={IconButton}
                  colorScheme="blue"
                  icon={<ChevronDownIcon fontSize={24} />}
                  aria-label="Additional add feed options"
                  borderLeftRadius={0}
                />
                <MenuList>
                  <MenuItem icon={<AddIcon />} as={Link} to={pages.addFeeds()}>
                    Add multiple feeds
                  </MenuItem>
                </MenuList>
              </Menu>
            </HStack>
          </HStack>
        </Flex>
        <HStack spacing={6}>
          {!userMeData?.result.migratedToPersonalFeeds && (
            <Text>
              Personal feeds are a new type of feed that will replace current (now considered
              &quot;legacy&quot;) feeds. They contain new features that have never been seen before,
              and are more reliable than legacy feeds. For more information, see the{" "}
              <ChakraLink as={Link} color="blue.300" to={pages.userFeedsFaq()}>
                Frequently Asked Questions
              </ChakraLink>{" "}
              page.
            </Text>
          )}
          {userMeData?.result.migratedToPersonalFeeds && (
            <Text>
              Every feed represents a news source that you can subscribe to. After adding a feed,
              you may then specify where you want articles for that feed to be sent to.
            </Text>
          )}
        </HStack>
      </Stack>
      {userFeedsResults?.total === 0 && (
        <Center>
          <Stack spacing={6}>
            <Stack alignItems="center">
              <Box p={12} rounded="full" bg="gray.700" opacity={0.3}>
                <FaRegNewspaper fontSize={128} />
              </Box>
              <Text fontSize={24} fontWeight="semibold">
                You don&apos;t have any feeds yet
              </Text>
            </Stack>
            <AddUserFeedDialog
              trigger={
                <Button colorScheme="blue" leftIcon={<AddIcon fontSize={12} />}>
                  Add a new feed
                </Button>
              }
            />
          </Stack>
        </Center>
      )}
      {userFeedsResults && userFeedsResults.total > 0 ? <UserFeedsTable /> : null}
    </>
  );
};
