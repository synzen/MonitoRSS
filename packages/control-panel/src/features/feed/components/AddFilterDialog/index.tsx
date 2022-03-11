import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  useDisclosure,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { AutoResizeTextarea } from '@/components/AutoResizeTextarea';
import { notifyError } from '@/utils/notifyError';

interface Props {
  onSubmit(data: Array<{
    category: string,
    value: string
  }>): Promise<void>
}

export const AddFilterDialog: React.FC<Props> = ({
  onSubmit,
}) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [category, setCategory] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  const onClickSave = async () => {
    if (!category || !value) {
      return;
    }

    try {
      setSaving(true);
      const mappedValues = value
        .split('\n')
        .map((v) => v.trim())
        .filter((v) => v)
        .map((v) => ({
          // Filters are applied case-insensitive
          category: category.toLowerCase(),
          value: v.toLowerCase(),
        }));
      await onSubmit(mappedValues);
      onClose();
    } catch (err) {
      console.error(err);
      notifyError(t('components.addFilterDialog.failedToSaveError'), err as Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        colorScheme="blue"
        onClick={onOpen}
      >
        {t('components.addFilterDialog.addButton')}
      </Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t('components.addFilterDialog.title')}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={6}>
              <FormControl>
                <FormLabel>Category</FormLabel>
                <Input onChange={({ target }) => setCategory(target.value)} />
              </FormControl>
              <FormControl>
                <FormLabel>Values</FormLabel>
                <AutoResizeTextarea minH="8rem" onChange={({ target }) => setValue(target.value)} />
                <FormHelperText>Each new line indicates a new and separate filter.</FormHelperText>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <Button
              mr={3}
              onClick={onClose}
              disabled={saving}
            >
              {t('components.addFilterDialog.cancel')}
            </Button>
            <Button
              colorScheme="blue"
              disabled={saving}
              onClick={onClickSave}
              isLoading={saving}
            >
              {t('components.addFilterDialog.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
