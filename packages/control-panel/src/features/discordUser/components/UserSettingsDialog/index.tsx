/* eslint-disable react/destructuring-assignment */
/* eslint-disable react/jsx-props-no-spreading */
import {
  Button,
  Divider,
  FormControl,
  HStack,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  Text,
} from '@chakra-ui/react';
import { useTranslation } from 'react-i18next';
import { useForm, useFieldArray } from 'react-hook-form';
import { useEffect } from 'react';
import { useDiscordUserMe } from '../../hooks';

interface FormValues {
  serverIds: string[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
}

export const UserSettingsDialog: React.FC<Props> = ({
  isOpen,
  onClose,
}) => {
  const {
    data: userMe,
  } = useDiscordUserMe();
  const {
    register,
    control,
    handleSubmit,
    setValue,
  } = useForm<FormValues>({
    defaultValues: {
      serverIds: [],
    },
  });
  const { fields, append } = useFieldArray({
    control,
    name: 'serverIds' as never,
  });
  const { t } = useTranslation();

  useEffect(() => {
    if (userMe?.supporter) {
      const initArray = new Array(userMe.supporter.maxGuilds).fill('');

      for (let i = 0; i < userMe.supporter.guilds.length; i += 1) {
        initArray[i] = userMe.supporter.guilds[i];
      }

      setValue('serverIds', initArray);
    }
  }, [userMe]);

  const onSubmit = (data: FormValues) => {
    console.log(data);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {t('features.discordUsers.components.settingsDialog.title')}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          {userMe && userMe.supporter && (
          <Stack spacing="4">
            <Text>
              {t('features.discordUsers.components.settingsDialog.description')}
            </Text>
            <form id="supporter-servers" onSubmit={handleSubmit(onSubmit)}>
              <Stack>
                {fields.map((field, index) => (
                  <FormControl key={field.id}>
                    <Input
                      {...register(`serverIds.${index}`)}
                      placeholder={
                        t('features.discordUsers.components.settingsDialog.serverInputPlaceholder')
                      }
                    />
                  </FormControl>
                ))}
              </Stack>
              <Divider />
            </form>
          </Stack>
          )}
        </ModalBody>
        <ModalFooter>
          <HStack>
            <Button
              onClick={onClose}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              form="supporter-servers"
              type="submit"
              onClick={onClose}
            >
              Save
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
