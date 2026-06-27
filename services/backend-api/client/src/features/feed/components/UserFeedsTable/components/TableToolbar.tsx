import {
  Button,
  Flex,
  HStack,
  IconButton,
  Input,
  InputGroup,
  Spinner,
  Stack,
  Text,
  chakra,
} from "@chakra-ui/react";
import {
  FaChevronDown,
  FaXmark,
  FaMagnifyingGlass,
  FaFilter,
  FaTableColumns,
} from "react-icons/fa6";
import { useTranslation } from "react-i18next";
import { VisibilityState } from "@tanstack/react-table";
import { UserFeedComputedStatus } from "../../../types";
import { UserFeedStatusTag } from "../UserFeedStatusTag";
import { SHARED_WITH_ME_COLUMN_ID, STATUS_FILTERS, TOGGLEABLE_COLUMNS } from "../constants";
import { MenuRoot, MenuTrigger, MenuContent, MenuCheckboxItem } from "@/components/ui/menu";

interface TableToolbarProps {
  searchInputRef?: React.RefObject<HTMLInputElement>;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  search: string;
  isFetching: boolean;
  statusFilters: UserFeedComputedStatus[];
  onStatusSelect: (statuses: UserFeedComputedStatus[]) => void;
  columnVisibility: VisibilityState;
  onColumnVisibilityChange: (
    visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState),
  ) => void;
  /** Drop the "Shared with Me" column toggle (it has no meaning in workspace scope). */
  excludeSharedWithMe?: boolean;
}

export const TableToolbar: React.FC<TableToolbarProps> = ({
  searchInputRef,
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
  excludeSharedWithMe,
}) => {
  const { t } = useTranslation();

  const toggleableColumns = excludeSharedWithMe
    ? TOGGLEABLE_COLUMNS.filter(({ id }) => id !== SHARED_WITH_ME_COLUMN_ID)
    : TOGGLEABLE_COLUMNS;

  const visibleColumnCount = toggleableColumns.filter(({ id }) => columnVisibility[id]).length;
  const selectedTableColumnCountLabel = `${visibleColumnCount} of ${toggleableColumns.length}`;

  const handleStatusToggle = (value: UserFeedComputedStatus) => {
    if (statusFilters.includes(value)) {
      onStatusSelect(statusFilters.filter((s) => s !== value));
    } else {
      onStatusSelect([...statusFilters, value]);
    }
  };

  const handleColumnVisibilityToggle = (id: string) => {
    onColumnVisibilityChange((prev) => {
      const isVisible = prev[id];
      const visibleCount = toggleableColumns.filter(({ id: colId }) => prev[colId]).length;
      const isLastVisible = isVisible && visibleCount === 1;

      if (isLastVisible) {
        return prev;
      }

      return {
        ...prev,
        [id]: !isVisible,
      };
    });
  };

  let searchEndElement: React.ReactNode;

  if (search && !isFetching) {
    searchEndElement = (
      <IconButton aria-label="Clear search" size="sm" variant="plain" onClick={onSearchClear}>
        <FaXmark color="fg.muted" />
      </IconButton>
    );
  } else if (search && isFetching) {
    searchEndElement = <Spinner size="sm" />;
  }

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
        <Flex as="fieldset" minWidth={0} flex={1} flexBasis="100%">
          <InputGroup
            minWidth={0}
            flex={1}
            startElement={<FaMagnifyingGlass color="fg.muted" />}
            endElement={searchEndElement}
          >
            <Input
              ref={searchInputRef}
              onChange={({ target: { value } }) => onSearchInputChange(value)}
              value={searchInput || ""}
              placeholder={t("pages.feeds.tableSearch")}
            />
          </InputGroup>
          <Button type="submit" ml={1}>
            <FaMagnifyingGlass />
            Search
          </Button>
        </Flex>
        <Flex>
          <MenuRoot closeOnSelect={false}>
            <MenuTrigger asChild>
              <Button maxWidth={200} width="100%">
                <FaFilter />
                <Text
                  overflow="hidden"
                  textAlign="left"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {statusFilters?.length
                    ? `Status: ${statusFilters.length} of ${STATUS_FILTERS.length}`
                    : "Status"}
                </Text>
                <FaChevronDown />
              </Button>
            </MenuTrigger>
            <MenuContent maxW="300px">
              {STATUS_FILTERS.map((val) => (
                <MenuCheckboxItem
                  key={val.value}
                  value={val.value}
                  checked={statusFilters.includes(val.value)}
                  onCheckedChange={() => handleStatusToggle(val.value)}
                >
                  <Stack>
                    <HStack alignItems="center">
                      <UserFeedStatusTag ariaHidden status={val.value} />
                      <chakra.span>{val.label}</chakra.span>
                    </HStack>
                    <chakra.span display="block" color="fg.muted">
                      {val.description}
                    </chakra.span>
                  </Stack>
                </MenuCheckboxItem>
              ))}
            </MenuContent>
          </MenuRoot>
        </Flex>
        <Flex>
          <MenuRoot closeOnSelect={false}>
            <MenuTrigger asChild>
              <Button
                maxWidth={200}
                width="100%"
                aria-label={`Display table columns: ${selectedTableColumnCountLabel}`}
              >
                <FaTableColumns />
                <Text
                  overflow="hidden"
                  textAlign="left"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {`Columns: ${selectedTableColumnCountLabel}`}
                </Text>
                <FaChevronDown />
              </Button>
            </MenuTrigger>
            <MenuContent maxW="250px">
              {toggleableColumns.map(({ id, label }) => {
                const isVisible = columnVisibility[id];
                const isLastVisible = isVisible && visibleColumnCount === 1;

                return (
                  <MenuCheckboxItem
                    key={id}
                    value={id}
                    checked={!!isVisible}
                    disabled={isLastVisible}
                    onCheckedChange={() => handleColumnVisibilityToggle(id)}
                  >
                    {label}
                  </MenuCheckboxItem>
                );
              })}
            </MenuContent>
          </MenuRoot>
        </Flex>
      </HStack>
    </form>
  );
};
