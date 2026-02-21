import { Button, Checkbox, Flex, Highlight, Link, Stack, Text } from "@chakra-ui/react";
import { CheckIcon, ChevronRightIcon } from "@chakra-ui/icons";
import { Link as RouterLink } from "react-router-dom";
import { CellContext, ColumnDef, HeaderContext, createColumnHelper } from "@tanstack/react-table";
import dayjs from "dayjs";
import { RowData } from "./types";
import { UserFeedComputedStatus } from "../../types";
import { UserFeedStatusTag } from "./UserFeedStatusTag";
import { DATE_FORMAT, pages } from "../../../../constants";
import { formatRefreshRateSeconds } from "../../../../utils/formatRefreshRateSeconds";

const columnHelper = createColumnHelper<RowData>();

interface ColumnConfig {
  id: string;
  header: string;
  cell: (info: CellContext<RowData, unknown>, search: string) => React.ReactNode;
  accessor?: keyof RowData | ((row: RowData) => unknown);
  sortable?: boolean;
}

const columnConfigs: ColumnConfig[] = [
  {
    id: "computedStatus",
    header: "Status",
    accessor: "computedStatus",
    cell: (info) => <UserFeedStatusTag status={info.getValue() as UserFeedComputedStatus} />,
    sortable: true,
  },
  {
    id: "title",
    header: "Title",
    accessor: "title",
    cell: (info, search) => {
      const value = info.getValue() as string;
      const feedId = info.row.original.id;

      if (!search) {
        return (
          <Link
            as={RouterLink}
            to={pages.userFeed(feedId)}
            color="blue.300"
            _hover={{ textDecoration: "underline" }}
          >
            {value}
          </Link>
        );
      }

      return (
        <Link as={RouterLink} to={pages.userFeed(feedId)} _hover={{ textDecoration: "underline" }}>
          <Highlight query={search} styles={{ bg: "orange.100" }}>
            {value}
          </Highlight>
        </Link>
      );
    },
    sortable: true,
  },
  {
    id: "url",
    header: "URL",
    accessor: "url",
    cell: (info, search) => {
      const value = info.getValue() as string;
      const { inputUrl } = info.row.original;
      const urlIsDifferentFromInput = inputUrl !== value;

      if (!search) {
        return (
          <Stack>
            <Link
              as="a"
              target="_blank"
              href={inputUrl || value}
              _hover={{ textDecoration: "underline" }}
              color="blue.300"
              title={inputUrl || value}
              onClick={(e) => e.stopPropagation()}
              overflow="hidden"
              textOverflow="ellipsis"
            >
              {inputUrl || value}
            </Link>
            {urlIsDifferentFromInput && (
              <Text
                color="whiteAlpha.600"
                fontSize="sm"
                display="inline"
                overflow="hidden"
                textOverflow="ellipsis"
              >
                Resolved to{" "}
                <Link
                  as="a"
                  fontSize="sm"
                  target="_blank"
                  href={value}
                  color="whiteAlpha.600"
                  _hover={{ textDecoration: "underline" }}
                  title={value}
                  onClick={(e) => e.stopPropagation()}
                >
                  {value}
                </Link>
              </Text>
            )}
          </Stack>
        );
      }

      return (
        <Link as="a" target="_blank" href={value} _hover={{ textDecoration: "underline" }}>
          <Highlight query={search} styles={{ bg: "orange.100" }}>
            {value}
          </Highlight>
        </Link>
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
    id: "ownedByUser",
    header: "Shared with Me",
    accessor: "ownedByUser",
    cell: (info) => {
      const isOwnedByCurrentUser = info.getValue() as boolean;

      return isOwnedByCurrentUser ? null : <CheckIcon />;
    },
    sortable: true,
  },
];

function createSelectColumn(): ColumnDef<RowData> {
  return columnHelper.display({
    id: "select",
    header: ({ table }: HeaderContext<RowData, unknown>) => (
      <Flex justifyContent="center" alignItems="center" width="100%">
        <Checkbox
          alignItems="center"
          width="min-content"
          isChecked={table.getIsAllRowsSelected()}
          onChange={(e) => {
            e.stopPropagation();
            table.getToggleAllRowsSelectedHandler()(e);
          }}
          isIndeterminate={table.getIsSomeRowsSelected()}
          cursor="pointer"
          aria-label="Check all currently loaded feeds for bulk actions"
        />
      </Flex>
    ),
    cell: ({ row }) => (
      <Flex alignItems="center" justifyContent="center" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          display="flex"
          alignItems="center"
          isChecked={row.getIsSelected()}
          aria-disabled={!row.getCanSelect()}
          onChange={(e) => {
            if (!row.getCanSelect()) return;
            e.stopPropagation();
            row.getToggleSelectedHandler()(e);
          }}
          isIndeterminate={row.getIsSomeSelected()}
          padding={3.5}
          cursor="pointer"
          __css={{
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

function createConfigureColumn(): ColumnDef<RowData> {
  return columnHelper.display({
    id: "configure",
    header: () => null,
    cell: ({ row }) => (
      <Button
        as={RouterLink}
        to={pages.userFeed(row.original.id)}
        role="link"
        variant="ghost"
        size="sm"
        rightIcon={<ChevronRightIcon boxSize={5} aria-hidden="true" />}
        aria-label={`Configure ${row.original.title}`}
      >
        Configure
      </Button>
    ),
  });
}

export function createTableColumns(search: string): ColumnDef<RowData>[] {
  const selectColumn = createSelectColumn();
  const configureColumn = createConfigureColumn();

  const dataColumns = columnConfigs.map((config) => {
    if (typeof config.accessor === "function") {
      return columnHelper.accessor(config.accessor, {
        id: config.id,
        header: () => <span>{config.header}</span>,
        cell: (info) => config.cell(info as CellContext<RowData, unknown>, search),
      });
    }

    return columnHelper.accessor(config.accessor as keyof RowData, {
      id: config.id,
      header: () => <span>{config.header}</span>,
      cell: (info) => config.cell(info as CellContext<RowData, unknown>, search),
    });
  }) as ColumnDef<RowData>[];

  return [selectColumn, ...dataColumns, configureColumn];
}

export { columnConfigs };
