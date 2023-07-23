import { ThemedSelect } from "../ThemedSelect";

export const UserFeedStatusSelectDropdown = () => {
  return (
    <ThemedSelect
      selectProps={{
        isSearchable: false,
        isMulti: true,
        closeMenuOnSelect: false,
        options: [
          {
            label: "Ok",
            value: "ok",
            data: {
              color: "green",
            },
          },
          {
            label: "Needs Attention",
            value: "needs-attention",
            data: {
              color: "yellow",
            },
          },
        ],
      }}
      options={[
        {
          label: "Ok",
          value: "ok",
          data: {
            color: "green",
          },
        },
        {
          label: "Needs Attention",
          value: "needs-attention",
          data: {
            color: "yellow",
          },
        },
      ]}
      onChange={(val) => {
        console.log(val);
      }}
    />
  );
};
