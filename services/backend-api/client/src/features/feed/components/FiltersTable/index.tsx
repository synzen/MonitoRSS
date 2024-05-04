/* eslint-disable react/no-unstable-nested-components */
import { ArrowDownIcon, ArrowUpIcon } from "@chakra-ui/icons";
import {
  Button,
  Checkbox,
  Flex,
  Stack,
  Table,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Box,
} from "@chakra-ui/react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Column, useRowSelect, useSortBy, useTable } from "react-table";
import { AddFilterDialog } from "../AddFilterDialog";

interface Props {
  data: Array<{ category: string; value: string }>;
  onFiltersChanged: (data: Array<{ category: string; value: string }>) => void;
  isUpdating?: boolean;
  isLoading?: boolean;
}

export const FiltersTable: React.FC<Props> = ({
  data,
  onFiltersChanged,
  isUpdating,
  isLoading,
}) => {
  const { t } = useTranslation();

  const columns = useMemo<Column<{ category: string; value: string }>[]>(
    () => [
      {
        Header: t("pages.filters.tableCategory") as string,
        accessor: "category",
      },
      {
        Header: t("pages.filters.tableValue") as string,
        accessor: "value",
      },
    ],
    []
  );

  const { getTableProps, getTableBodyProps, headerGroups, prepareRow, rows, selectedFlatRows } =
    useTable(
      {
        columns,
        data,
      },
      useSortBy,
      useRowSelect,
      (hooks) => {
        hooks.visibleColumns.push((cols) => [
          {
            id: "selection",
            Header: ({ getToggleAllRowsSelectedProps }) => {
              const { indeterminate, title, checked, onChange } = getToggleAllRowsSelectedProps();

              return (
                <Checkbox
                  isIndeterminate={indeterminate}
                  title={title}
                  isChecked={checked}
                  onChange={onChange}
                />
              );
            },
            // @ts-ignore
            Cell: ({ row }) => {
              const { indeterminate, title, checked, onChange } = row.getToggleRowSelectedProps();

              return (
                <Checkbox
                  isIndeterminate={indeterminate}
                  title={title}
                  isChecked={checked}
                  onChange={onChange}
                />
              );
            },
          },
          ...cols,
        ]);
      }
    );

  const onAddFilters = async (addedFilters: Array<{ category: string; value: string }>) => {
    onFiltersChanged([...addedFilters, ...data]);
  };

  const onRemoveFilters = async () => {
    const newFiltersState = [...data];
    const selectedIndexes = selectedFlatRows.map((row) => row.index).sort();

    for (let i = selectedIndexes.length - 1; i >= 0; i -= 1) {
      newFiltersState.splice(selectedIndexes[i], 1);
    }

    onFiltersChanged(newFiltersState);
  };

  return (
    <Stack spacing={6}>
      <Stack>
        <Flex justifyContent="space-between" flexWrap="wrap">
          <Button
            isDisabled={selectedFlatRows.length === 0 || isUpdating || isLoading}
            isLoading={isUpdating}
            colorScheme="red"
            variant="outline"
            onClick={onRemoveFilters}
            marginRight="4"
            marginBottom="2"
          >
            <span>{t("pages.filters.removeSelectedFilters")}</span>
          </Button>
          <AddFilterDialog onSubmit={onAddFilters} />
        </Flex>
        <Box overflow="auto">
          <Table
            {...getTableProps()}
            whiteSpace="nowrap"
            marginBottom="5"
            background="gray.800"
            borderColor="gray.700"
            borderWidth="2px"
            boxShadow="lg"
          >
            <Thead>
              {headerGroups.map((headerGroup) => (
                <Tr {...headerGroup.getHeaderGroupProps()}>
                  {headerGroup.headers.map((column) => (
                    <Th {...column.getHeaderProps(column.getSortByToggleProps())}>
                      <Flex alignItems="center" userSelect="none">
                        <span>
                          {column.render("Header")}
                          {column.isSorted && column.isSortedDesc && (
                            <ArrowDownIcon marginLeft="1" />
                          )}
                          {column.isSorted && !column.isSortedDesc && (
                            <ArrowUpIcon marginLeft="1" />
                          )}
                        </span>
                      </Flex>
                    </Th>
                  ))}
                </Tr>
              ))}
            </Thead>
            <Tbody {...getTableBodyProps()}>
              {rows.map((row) => {
                prepareRow(row);

                return (
                  <Tr {...row.getRowProps()}>
                    {row.cells.map((cell) => (
                      <Td {...cell.getCellProps()}>{cell.render("Cell")}</Td>
                    ))}
                  </Tr>
                );
              })}
            </Tbody>
          </Table>
        </Box>
      </Stack>
    </Stack>
  );
};
