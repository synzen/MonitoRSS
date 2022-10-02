import {
  Button,
  FormControl,
  FormErrorMessage,
  FormLabel,
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
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import React, { useEffect } from 'react';
import { useDiscordServerChannels } from '@/features/discordServers';
import { ThemedSelect } from '@/components';

const formSchema = object({
  channelId: string().required(),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  serverId?: string
  onUpdate: (data: FormData) => Promise<void>
  trigger: React.ReactElement
  defaultValues: FormData
}

export const EditConnectionChannelDialog: React.FC<Props> = ({
  serverId,
  onUpdate,
  trigger,
  defaultValues,
}) => {
  const { isOpen, onClose, onOpen } = useDisclosure();
  const { t } = useTranslation();
  const {
    handleSubmit,
    control,
    reset,
    formState: {
      isDirty,
      errors,
      isSubmitting,
    },
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: 'all',
    defaultValues,
  });
  const { data, error: channelsError, status } = useDiscordServerChannels({ serverId });

  const loadingChannels = status === 'loading' || status === 'idle';

  const onSubmit = async ({ channelId }: FormData) => {
    await onUpdate({ channelId });
    onClose();
    reset({ channelId });
  };

  useEffect(() => {
    reset();
  }, [isOpen]);

  return (
    <>
      {React.cloneElement(trigger, { onClick: onOpen })}
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>
            {t('features.feed.components.updateDiscordChannelConnectionDialog.title')}
          </ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <form id="addfeed" onSubmit={handleSubmit(onSubmit)}>
              <Stack spacing={4}>
                <FormControl isInvalid={!!errors.channelId}>
                  <FormLabel>
                    {t('features.feed.components'
                      + '.addDiscordChannelConnectionDialog.formChannelLabel')}
                  </FormLabel>
                  <Controller
                    name="channelId"
                    control={control}
                    render={({ field }) => (
                      <ThemedSelect
                        loading={loadingChannels}
                        isDisabled={isSubmitting || loadingChannels || !!channelsError}
                        options={data?.results.map((channel) => ({
                          label: channel.name,
                          value: channel.id,
                        })) || []}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        value={field.value}
                      />
                    )}
                  />
                  <FormErrorMessage>
                    {errors.channelId?.message}
                  </FormErrorMessage>
                </FormControl>
              </Stack>
            </form>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="ghost"
              mr={3}
              onClick={onClose}
              disabled={isSubmitting}
            >
              {t('common.buttons.cancel')}
            </Button>
            <Button
              colorScheme="blue"
              type="submit"
              form="addfeed"
              isLoading={isSubmitting}
              isDisabled={!isDirty || isSubmitting}
            >
              {t('common.buttons.save')}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
