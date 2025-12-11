import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TableSearchState } from "../types";

interface UseTableSearchOptions {
  onSearchChange: (search: string) => void;
}

export function useTableSearch({ onSearchChange }: UseTableSearchOptions): TableSearchState {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsSearch = searchParams.get("search") || "";
  const [searchInput, setSearchInput] = useState(searchParamsSearch);

  useEffect(() => {
    onSearchChange(searchParamsSearch);
  }, [searchParamsSearch, onSearchChange]);

  const onSearchSubmit = (val?: string) => {
    const useVal = val ?? searchInput;
    setSearchParams((prev) => {
      const newParams = new URLSearchParams(prev);

      if (useVal) {
        newParams.set("search", useVal);
      } else {
        newParams.delete("search");
      }

      return newParams;
    });
  };

  const onSearchClear = () => {
    setSearchInput("");
    onSearchSubmit("");
  };

  return {
    searchInput,
    search: searchParamsSearch,
    setSearchInput,
    onSearchSubmit: () => onSearchSubmit(),
    onSearchClear,
  };
}
