import { FaCircleExclamation, FaClock } from "react-icons/fa6";
import { FaCheckCircle, FaPauseCircle } from "react-icons/fa";
import { UserFeedComputedStatus } from "../../types";
import getChakraColor from "../../../../utils/getChakraColor";

interface Props {
  status: UserFeedComputedStatus;
  ariaHidden?: boolean;
}

export const UserFeedStatusTag: React.FC<Props> = ({ status, ariaHidden }) => {
  if (status === UserFeedComputedStatus.RequiresAttention) {
    return (
      <FaCircleExclamation
        aria-label="Requires attention"
        fontSize={18}
        color={getChakraColor("red.300")}
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.Retrying) {
    return (
      <FaClock
        aria-label="Currently retrying after failed requests"
        fontSize={18}
        color={getChakraColor("orange.200")}
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.ManuallyDisabled) {
    return (
      <FaPauseCircle
        aria-label="Manually disabled"
        color={getChakraColor("whiteAlpha.800")}
        fontSize={18}
        aria-hidden
      />
    );
  }

  return <FaCheckCircle aria-label="Ok" color={getChakraColor("green.300")} fontSize={18} />;
};
