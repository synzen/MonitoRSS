import { CheckCircleIcon, WarningIcon } from '@chakra-ui/icons';
import { Feed } from '../../types';

interface Props {
  status: Feed['status'];
}

export const FeedStatusIcon: React.FC<Props> = ({ status }) => {
  if (status === 'failed') {
    return (
      <WarningIcon
        fontSize="2xl"
        color="red.400"
        verticalAlign="middle"
      />
    );
  }

  return (
    <CheckCircleIcon
      fontSize="2xl"
      color="green.500"
      verticalAlign="middle"
    />
  );
};
