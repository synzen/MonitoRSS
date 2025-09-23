import CreatableSelect from "react-select/creatable";
import { REACT_SELECT_STYLES } from "@/constants/reactSelectStyles";

interface Props {
  onChangeValue: (value: string) => void;
}

const defaultOptions = [
  {
    value: "title",
    label: "Title",
  },
  {
    value: "description",
    label: "Description",
  },
  {
    value: "author",
    label: "Author",
  },
  {
    value: "summary",
    label: "Summary",
  },
  {
    value: "tags",
    label: "Tags",
  },
];

export const FilterCategorySelect: React.FC<Props> = ({ onChangeValue }) => (
  <CreatableSelect
    onChange={(option: any) => option && onChangeValue(option.value)}
    styles={REACT_SELECT_STYLES()}
    options={defaultOptions}
  />
);
