import { CSSProperties } from "react";
import { HStack, Th } from "@chakra-ui/react";
import { ChevronDownIcon, ChevronUpIcon } from "@chakra-ui/icons";
import { Header, flexRender } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { RowData } from "../types";

interface SortableTableHeaderProps {
  header: Header<RowData, unknown>;
  isFetching: boolean;
}

export const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({ header, isFetching }) => {
  const isFixedColumn = header.id === "select" || header.id === "configure";

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: header.id,
    disabled: isFixedColumn,
  });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    position: "relative",
    zIndex: isDragging ? 1 : 0,
  };

  const isSorted = header.column.getIsSorted();
  const canSort = header.column.getCanSort();

  let cursor: CSSProperties["cursor"] = isFixedColumn ? "default" : "grab";

  if (isFetching) {
    cursor = "not-allowed";
  } else if (canSort && !isDragging) {
    cursor = "pointer";
  }

  return (
    <Th
      ref={setNodeRef}
      style={style}
      {...(isFixedColumn ? {} : attributes)}
      {...(isFixedColumn ? {} : listeners)}
      cursor={cursor}
      onClick={!isDragging ? header.column.getToggleSortingHandler() : undefined}
      userSelect="none"
    >
      <HStack alignItems="center">
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {isSorted === "desc" && <ChevronDownIcon aria-label="sorted descending" fontSize={16} />}
        {isSorted === "asc" && <ChevronUpIcon aria-label="sorted ascending" fontSize={16} />}
      </HStack>
    </Th>
  );
};
