import { Modal, ModalOverlay } from '@chakra-ui/react';
import { FeedConnectionType } from '../../../feed/constants';
import { DiscordChannelConnectionContent } from './DiscordChannelConnectionContent';
import { DiscordWebhookConnectionContent } from './DiscordWebhookConnectionContent';

interface Props {
  type?: FeedConnectionType
  isOpen: boolean;
  onClose: () => void;
}

export const AddConnectionDialog = ({ type, isOpen, onClose }: Props) => {
  let modalContent: React.ReactNode;

  if (type === FeedConnectionType.DiscordChannel) {
    modalContent = <DiscordChannelConnectionContent onClose={onClose} isOpen={isOpen} />;
  } else if (type === FeedConnectionType.DiscordWebhook) {
    modalContent = <DiscordWebhookConnectionContent onClose={onClose} isOpen={isOpen} />;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
    >
      <ModalOverlay />
      {modalContent}
    </Modal>
  );
};
