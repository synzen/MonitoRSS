import { CheckCircleIcon, NotAllowedIcon, WarningIcon } from '@chakra-ui/icons';
import { UserFeed, UserFeedDisabledCode } from '../../types';

interface Props {
  disabledCode?: UserFeed['disabledCode']
}

export const FeedStatusTag: React.FC<Props> = ({ disabledCode }) => {
  if (
    disabledCode === UserFeedDisabledCode.FailedRequests
    || disabledCode === UserFeedDisabledCode.BadFormat
  ) {
    return <WarningIcon boxSize={5} color="red.500" />;
  }

  if (disabledCode === UserFeedDisabledCode.Manual) {
    return <NotAllowedIcon boxSize={5} opacity="0.5" />;
  }

  return <CheckCircleIcon boxSize={5} color="green.500" />;
};
