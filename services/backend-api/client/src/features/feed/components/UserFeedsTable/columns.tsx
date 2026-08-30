import {
  Button,
  Flex,
  Highlight,
  Link as ChakraLink,
  Stack,
  Text,
} from "@chakra-ui/react";
import { FaCheck, FaChevronRight } from "react-icons/fa6";
import { Link as RouterLink } from "react-router-dom";
import {
  CellContext,
  ColumnDef,
  HeaderContext,
  createColumnHelper,
} from "@tanstack/react-table";
import dayjs from "dayjs";
import { Checkbox } from "@/components/ui/checkbox";
import { RowData } from "./types";
import { UserFeedComputedStatus } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { DATE_FORMAT, pages } from "../../../../constants";
import type { RouteScope } from "../../../../constants";
import { formatRefreshRateSeconds } from "../../../../utils/formatRefreshRateSeconds";
import { FEED_TABLE_FOCUS_KEY, SHARED_WITH_ME_COLUMN_ID } from "./constants";

const columnHelper = createColumnHelper<RowData>();

function rememberFeedForReturn(feedId: string) {
  sessionStorage.setItem(FEED_TABLE_FOCUS_KEY, feedId);
}

interface ColumnConfig {
  id: string;
  header: string;
  cell: (
    info: CellContext<RowData, unknown>,
    search: string,
    scope?: RouteScope,
    isCompact?: boolean,
  ) => React.ReactNode;
  accessor?: keyof RowData | ((row: RowData) => unknown);
  sortable?: boolean;
}

const columnConfigs: ColumnConfig[] = [
  {
    id: "computedStatus",
    header: "Status",
    accessor: "computedStatus",
    cell: (info, _search, _scope, isCompact) => (
      <UserFeedStatusTag
        status={info.getValue() as UserFeedComputedStatus}
        isCompact={isCompact}
      />
    ),
    sortable: true,
  },
  {
    id: "title",
    header: "Title",
    accessor: "title",
    cell: (info, search, scope) => {
      const value = info.getValue() as string;
      const feedId = info.row.original.id;

      if (!search) {
        return (
          <ChakraLink
            asChild
            color="text.link"
            _hover={{ textDecoration: "underline" }}
          >
            <RouterLink
              to={pages.userFeed(feedId, { scope })}
              onClick={() => rememberFeedForReturn(feedId)}
            >
              {value}
            </RouterLink>
          </ChakraLink>
        );
      }

      return (
        <ChakraLink asChild _hover={{ textDecoration: "underline" }}>
          <RouterLink
            to={pages.userFeed(feedId, { scope })}
            onClick={() => rememberFeedForReturn(feedId)}
          >
            <Highlight query={search} styles={{ bg: "orange.100" }}>
              {value}
            </Highlight>
          </RouterLink>
        </ChakraLink>
      );
    },
    sortable: true,
  },
  {
    id: "url",
    header: "URL",
    accessor: "url",
    cell: (info, search, _scope, isCompact) => {
      const value = info.getValue() as string;
      const { inputUrl } = info.row.original;
      const urlIsDifferentFromInput = inputUrl !== value;

      if (!search) {
        return (
          <Stack>
            <ChakraLink
              as="a"
              target="_blank"
              href={inputUrl || value}
              _hover={{ textDecoration: "underline" }}
              color="text.link"
              title={inputUrl || value}
              onClick={(e) => e.stopPropagation()}
              overflow={isCompact ? undefined : "hidden"}
              textOverflow={isCompact ? undefined : "ellipsis"}
            >
              {inputUrl || value}
            </ChakraLink>
            {!isCompact && urlIsDifferentFromInput && (
              <Text
                color="fg.muted"
                fontSize="sm"
                display="inline"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                Resolved to{" "}
                <ChakraLink
                  as="a"
                  fontSize="sm"
                  target="_blank"
                  href={value}
                  color="fg.muted"
                  _hover={{ textDecoration: "underline" }}
                  title={value}
                  onClick={(e) => e.stopPropagation()}
                >
                  {value}
                </ChakraLink>
              </Text>
            )}
          </Stack>
        );
      }

      return (
        <ChakraLink
          as="a"
          target="_blank"
          href={value}
          _hover={{ textDecoration: "underline" }}
        >
          <Highlight query={search} styles={{ bg: "orange.100" }}>
            {value}
          </Highlight>
        </ChakraLink>
      );
    },
    sortable: true,
  },
  {
    id: "createdAt",
    header: "Added on",
    accessor: "createdAt",
    cell: (info) => {
      const value = info.getValue() as string | undefined;
      if (!value) return null;

      return <span>{dayjs(value).format(DATE_FORMAT)}</span>;
    },
    sortable: true,
  },
  {
    id: "refreshRateSeconds",
    header: "Refresh Rate",
    accessor: (row) => row.refreshRateSeconds,
    cell: (info) => {
      const value = info.getValue() as number | undefined;
      if (!value) return <span>-</span>;

      return <span>{formatRefreshRateSeconds(value)}</span>;
    },
    sortable: true,
  },
  {
    id: SHARED_WITH_ME_COLUMN_ID,
    header: "Shared with Me",
    accessor: "ownedByUser",
    cell: (info, _search, _scope, isCompact) => {
      const isOwnedByCurrentUser = info.getValue() as boolean;

      return isOwnedByCurrentUser ? null : <FaCheck size={isCompact ? 12 : 16} />;
    },
    sortable: true,
  },
];

function createSelectColumn(isCompact?: boolean): ColumnDef<RowData> {
  return columnHelper.display({
    id: "select",
    header: ({ table }: HeaderContext<RowData, unknown>) => (
      <Flex justifyContent="center" alignItems="center" width="100%">
        <Checkbox
          alignItems="center"
          width="min-content"
          checked={
            table.getIsSomeRowsSelected()
              ? "indeterminate"
              : table.getIsAllRowsSelected()
          }
          onCheckedChange={(details) => {
            table.toggleAllRowsSelected(!!details.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          cursor="pointer"
          aria-label="Check all currently loaded feeds for bulk actions"
        />
      </Flex>
    ),
    cell: ({ row }) => (
      <Flex
        alignItems="center"
        justifyContent="center"
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          display="flex"
          alignItems="center"
          checked={
            row.getIsSomeSelected() ? "indeterminate" : row.getIsSelected()
          }
          aria-disabled={!row.getCanSelect()}
          onCheckedChange={(details) => {
            if (!row.getCanSelect()) return;
            row.toggleSelected(!!details.checked);
          }}
          padding={isCompact ? 2 : 3.5}
          cursor="pointer"
          css={{
            _hover: {
              background: "whiteAlpha.300",
              borderRadius: "full",
            },
          }}
          aria-label={`Check feed ${row.original.title} for bulk actions`}
        />
      </Flex>
    ),
  });
}

function createConfigureColumn(
  scope?: RouteScope,
  isCompact?: boolean,
): ColumnDef<RowData> {
  return columnHelper.display({
    id: "configure",
    header: () => null,
    cell: ({ row }) => {
      const configureLink = (
        <RouterLink
          to={pages.userFeed(row.original.id, { scope })}
          onClick={() => rememberFeedForReturn(row.original.id)}
        >
          Configure
          <FaChevronRight aria-hidden="true" size={isCompact ? 10 : undefined} />
        </RouterLink>
      );

      if (isCompact) {
        return (
          <ChakraLink
            asChild
            color="text.link"
            fontSize="sm"
            aria-label={`Configure ${row.original.title}`}
            _hover={{ textDecoration: "underline" }}
          >
            {configureLink}
          </ChakraLink>
        );
      }

      return (
        <Button
          asChild
          role="link"
          variant="ghost"
          size="sm"
          color="text.link"
          aria-label={`Configure ${row.original.title}`}
        >
          {configureLink}
        </Button>
      );
    },
  });
}

export function createTableColumns(
  search: string,
  scope?: RouteScope,
  options?: { excludeSharedWithMe?: boolean; isCompact?: boolean },
): ColumnDef<RowData>[] {
  const selectColumn = createSelectColumn(options?.isCompact);
  const configureColumn = createConfigureColumn(scope, options?.isCompact);

  const visibleConfigs = options?.excludeSharedWithMe
    ? columnConfigs.filter((config) => config.id !== SHARED_WITH_ME_COLUMN_ID)
    : columnConfigs;

  const dataColumns = visibleConfigs.map((config) => {
    if (typeof config.accessor === "function") {
      return columnHelper.accessor(config.accessor, {
        id: config.id,
        header: () => <span>{config.header}</span>,
        cell: (info) =>
          config.cell(
            info as CellContext<RowData, unknown>,
            search,
            scope,
            options?.isCompact,
          ),
      });
    }

    return columnHelper.accessor(config.accessor as keyof RowData, {
      id: config.id,
      header: () => <span>{config.header}</span>,
      cell: (info) =>
        config.cell(
          info as CellContext<RowData, unknown>,
          search,
          scope,
          options?.isCompact,
        ),
    });
  }) as ColumnDef<RowData>[];

  return [selectColumn, ...dataColumns, configureColumn];
}

export { columnConfigs };
