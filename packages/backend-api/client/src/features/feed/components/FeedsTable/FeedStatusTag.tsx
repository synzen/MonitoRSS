import { Badge } from '@chakra-ui/react';
import { Feed } from '../../types';

interface Props {
  status: Feed['status']
}

export const FeedStatusTag: React.FC<Props> = ({ status, size }) => {
  let colorScheme: string;

  if (status === 'ok') {
    colorScheme = 'green';
  } else if (status === 'failed') {
    colorScheme = 'red';
  } else if (status === 'disabled') {
    colorScheme = 'orange';
  } else {
    colorScheme = 'gray';
  }

  return (
    <Badge
      colorScheme={colorScheme}
    >
      {status}
    </Badge>
  );
};
