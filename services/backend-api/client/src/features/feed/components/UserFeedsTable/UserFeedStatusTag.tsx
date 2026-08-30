import { Icon } from "@chakra-ui/react";
import { FaCircleExclamation, FaClock, FaCircleMinus } from "react-icons/fa6";
import { FaCheckCircle, FaPauseCircle } from "react-icons/fa";
import { UserFeedComputedStatus } from "../../types";

interface Props {
  status: UserFeedComputedStatus;
  ariaHidden?: boolean;
  isCompact?: boolean;
}

export const UserFeedStatusTag: React.FC<Props> = ({ status, ariaHidden, isCompact }) => {
  const boxSize = isCompact ? 4 : 5;

  if (status === UserFeedComputedStatus.RequiresAttention) {
    return (
      <Icon
        as={FaCircleExclamation}
        aria-label="Requires attention"
        boxSize={boxSize}
        color="text.error"
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.Retrying) {
    return (
      <Icon
        as={FaClock}
        aria-label="Currently retrying after failed requests"
        boxSize={boxSize}
        color="text.warning"
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.ManuallyDisabled) {
    return (
      <Icon
        as={FaPauseCircle}
        aria-label="Manually disabled"
        boxSize={boxSize}
        color="fg"
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.FeedLimitExceeded) {
    return (
      <Icon
        as={FaCircleMinus}
        aria-label="Feed limit exceeded"
        boxSize={boxSize}
        color="text.warning"
        aria-hidden={ariaHidden}
      />
    );
  }

  return <Icon as={FaCheckCircle} aria-label="Ok" boxSize={boxSize} color="text.success" />;
};
