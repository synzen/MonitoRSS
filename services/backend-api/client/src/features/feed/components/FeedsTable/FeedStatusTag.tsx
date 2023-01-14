import { Badge } from "@chakra-ui/react";
import { Feed } from "@/types";

interface Props {
  status: Feed["status"];
}

export const FeedStatusTag: React.FC<Props> = ({ status }) => {
  let colorScheme: string;

  if (status === "ok") {
    colorScheme = "green";
  } else if (status === "failed") {
    colorScheme = "red";
  } else if (status === "failing") {
    colorScheme = "orange";
  } else if (status === "disabled") {
    colorScheme = "yellow";
  } else {
    colorScheme = "gray";
  }

  return <Badge colorScheme={colorScheme}>{status}</Badge>;
};
