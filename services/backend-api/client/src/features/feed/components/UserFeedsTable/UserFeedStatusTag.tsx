import { FaCircleExclamation, FaPause } from "react-icons/fa6";
import { FaCheckCircle } from "react-icons/fa";
import { UserFeed, UserFeedDisabledCode } from "../../types";
import getChakraColor from "../../../../utils/getChakraColor";

interface Props {
  disabledCode?: UserFeed["disabledCode"];
}

export const UserFeedStatusTag: React.FC<Props> = ({ disabledCode }) => {
  if (
    disabledCode === UserFeedDisabledCode.FailedRequests ||
    disabledCode === UserFeedDisabledCode.BadFormat
  ) {
    return <FaCircleExclamation fontSize={18} color={getChakraColor("red.300")} />;
  }

  if (disabledCode === UserFeedDisabledCode.Manual) {
    return <FaPause opacity="0.5" fontSize={18} />;
  }

  return <FaCheckCircle color={getChakraColor("green.500")} fontSize={18} />;
};
