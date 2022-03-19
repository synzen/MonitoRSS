import { Spinner, SpinnerProps } from '@chakra-ui/react';

interface Props {
  size?: SpinnerProps['size']
}

export const Loading: React.FC<Props> = ({ size }) => <Spinner size={size || 'lg'} />;
