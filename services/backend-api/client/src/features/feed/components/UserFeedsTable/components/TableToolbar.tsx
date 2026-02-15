import {
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  InputLeftElement,
  InputRightElement,
  Menu,
  MenuButton,
  MenuItemOption,
  MenuList,
  MenuOptionGroup,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import { ChevronDownIcon, CloseIcon, SearchIcon } from "@chakra-ui/icons";
import { FaFilter, FaTableColumns } from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import { VisibilityState } from "@tanstack/react-table";
import { UserFeedComputedStatus } from "../../../types";
import { UserFeedStatusTag } from "../UserFeedStatusTag";
import { STATUS_FILTERS, TOGGLEABLE_COLUMNS } from "../constants";

interface TableToolbarProps {
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  search: string;
  isFetching: boolean;
  statusFilters: UserFeedComputedStatus[];
  onStatusSelect: (statuses: UserFeedComputedStatus[]) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (visibility: VisibilityState) => void;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  onSearchClear,
  search,
  isFetching,
  statusFilters,
  onStatusSelect,
  columnVisibility,
  onColumnVisibilityChange,
}) => {
  const { t } = useTranslation();

  const visibleColumnCount = TOGGLEABLE_COLUMNS.filter(({ id }) => columnVisibility[id]).length;
  const selectedTableColumnCountLabel = `${visibleColumnCount} of ${TOGGLEABLE_COLUMNS.length}`;

  const handleStatusChange = (statuses: string[] | string) => {
    if (typeof statuses === "string") {
      onStatusSelect([statuses as UserFeedComputedStatus]);

      return;
    }

    onStatusSelect(statuses as UserFeedComputedStatus[]);
  };

  const handleColumnVisibilityChange = (values: string[] | string) => {
    if (Array.isArray(values) && values.length === 0) {
      return;
    }

    const newVisibility: VisibilityState = {};
    TOGGLEABLE_COLUMNS.forEach(({ id }) => {
      newVisibility[id] = Array.isArray(values) ? values.includes(id) : false;
    });
    onColumnVisibilityChange(newVisibility);
  };

  return (
    <form
      id="user-feed-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearchSubmit();
      }}
    >
      <HStack flexWrap="wrap">
        <Flex as="fieldset" width="100%" flex={1}>
          <InputGroup width="min-content" flex={1}>
            <InputLeftElement pointerEvents="none">
              <SearchIcon color="gray.400" />
            </InputLeftElement>
            <Input
              onChange={({ target: { value } }) => onSearchInputChange(value)}
              value={searchInput || ""}
              minWidth="275px"
              placeholder={t("pages.feeds.tableSearch")}
            />
            {search && !isFetching && (
              <InputRightElement>
                <IconButton
                  aria-label="Clear search"
                  icon={<CloseIcon color="gray.400" />}
                  size="sm"
                  variant="link"
                  onClick={onSearchClear}
                />
              </InputRightElement>
            )}
            {search && isFetching && (
              <InputRightElement>
                <Spinner size="sm" />
              </InputRightElement>
            )}
          </InputGroup>
          <Button leftIcon={<SearchIcon />} type="submit" ml={1}>
            Search
          </Button>
        </Flex>
        <Flex>
          <Menu closeOnSelect={false}>
            <MenuButton
              as={Button}
              leftIcon={<FaFilter />}
              rightIcon={<ChevronDownIcon />}
              maxWidth={200}
              width="100%"
            >
              <Text overflow="hidden" textAlign="left" textOverflow="ellipsis" whiteSpace="nowrap">
                {statusFilters?.length
                  ? `Status: ${statusFilters.length} of ${STATUS_FILTERS.length}`
                  : "Status"}
              </Text>
            </MenuButton>
            <MenuList maxW="300px">
              <MenuOptionGroup type="checkbox" onChange={handleStatusChange} value={statusFilters}>
                {STATUS_FILTERS.map((val) => (
                  <MenuItemOption key={val.value} value={val.value}>
                    <Stack>
                      <HStack alignItems="center">
                        <UserFeedStatusTag ariaHidden status={val.value} />
                        <chakra.span>{val.label}</chakra.span>
                      </HStack>
                      <chakra.span display="block" color="whiteAlpha.600">
                        {val.description}
                      </chakra.span>
                    </Stack>
                  </MenuItemOption>
                ))}
              </MenuOptionGroup>
            </MenuList>
          </Menu>
        </Flex>
        <Flex>
          <Menu closeOnSelect={false}>
            <MenuButton
              as={Button}
              leftIcon={<FaTableColumns />}
              rightIcon={<ChevronDownIcon />}
              maxWidth={200}
              width="100%"
              aria-label={`Display table columns: ${selectedTableColumnCountLabel}`}
            >
              <Text overflow="hidden" textAlign="left" textOverflow="ellipsis" whiteSpace="nowrap">
                {`Columns: ${selectedTableColumnCountLabel}`}
              </Text>
            </MenuButton>
            <MenuList maxW="250px">
              <MenuOptionGroup
                type="checkbox"
                value={TOGGLEABLE_COLUMNS.filter(({ id }) => columnVisibility[id]).map(
                  ({ id }) => id,
                )}
                onChange={handleColumnVisibilityChange}
              >
                {TOGGLEABLE_COLUMNS.map(({ id, label }) => {
                  const isVisible = columnVisibility[id];
                  const isLastVisible = isVisible && visibleColumnCount === 1;

                  return (
                    <MenuItemOption key={id} value={id} isDisabled={isLastVisible}>
                      {label}
                    </MenuItemOption>
                  );
                })}
              </MenuOptionGroup>
            </MenuList>
          </Menu>
        </Flex>
      </HStack>
    </form>
  );
};
