import { FaCircleExclamation, FaClock } from "react-icons/fa6";
import { FaCheckCircle, FaPauseCircle } from "react-icons/fa";
import { UserFeedComputedStatus } from "../../types";
import getChakraColor from "../../../../utils/getChakraColor";

interface Props {
  status: UserFeedComputedStatus;
}

export const UserFeedStatusTag: React.FC<Props> = ({ status }) => {
  if (status === UserFeedComputedStatus.RequiresAttention) {
    return (
      <FaCircleExclamation
        aria-label="Requires attention"
        fontSize={18}
        color={getChakraColor("red.300")}
      />
    );
  }

  if (status === UserFeedComputedStatus.Retrying) {
    return (
      <FaClock
        aria-label="Currently retrying after failed requests"
        fontSize={18}
        color={getChakraColor("orange.200")}
      />
    );
  }

  if (status === UserFeedComputedStatus.ManuallyDisabled) {
    return <FaPauseCircle aria-label="Manually disabled" opacity="0.5" fontSize={18} />;
  }

  return <FaCheckCircle aria-label="Ok" color={getChakraColor("green.500")} fontSize={18} />;
};
