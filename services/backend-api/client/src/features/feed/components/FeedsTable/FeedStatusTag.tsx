import { Badge } from "@chakra-ui/react";
import { Feed } from "@/types";

interface Props {
  status: Feed["status"];
}

export const FeedStatusTag: React.FC<Props> = ({ status }) => {
  let colorScheme: string;
  let value: string = status;

  if (status === "ok") {
    colorScheme = "green";
  } else if (status === "failed") {
    colorScheme = "red";
  } else if (status === "failing") {
    colorScheme = "orange";
  } else if (status === "disabled") {
    colorScheme = "yellow";
  } else if (status === "converted-to-user") {
    colorScheme = "purple";
    value = "Converted to Personal";
  } else {
    colorScheme = "gray";
  }

  return <Badge colorScheme={colorScheme}>{value}</Badge>;
};
