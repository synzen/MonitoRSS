import { Icon } from "@chakra-ui/react";
import { FaCircleExclamation, FaClock } from "react-icons/fa6";
import { FaCheckCircle, FaPauseCircle } from "react-icons/fa";
import { UserFeedComputedStatus } from "../../types";

interface Props {
  status: UserFeedComputedStatus;
  ariaHidden?: boolean;
}

export const UserFeedStatusTag: React.FC<Props> = ({ status, ariaHidden }) => {
  if (status === UserFeedComputedStatus.RequiresAttention) {
    return (
      <Icon
        as={FaCircleExclamation}
        aria-label="Requires attention"
        boxSize={5}
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
        boxSize={5}
        color="text.warning"
        aria-hidden={ariaHidden}
      />
    );
  }

  if (status === UserFeedComputedStatus.ManuallyDisabled) {
    return (
      <Icon as={FaPauseCircle} aria-label="Manually disabled" boxSize={5} color="fg" aria-hidden />
    );
  }

  return <Icon as={FaCheckCircle} aria-label="Ok" boxSize={5} color="text.success" />;
};
