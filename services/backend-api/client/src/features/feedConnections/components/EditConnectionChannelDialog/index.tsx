import {
  Button,
  FormControl,
  FormErrorMessage,
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
import { yupResolver } from '@hookform/resolvers/yup';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { InferType, object, string } from 'yup';
import React, { useEffect } from 'react';
import { DiscordServerSearchSelectv2, useDiscordServerChannels } from '@/features/discordServers';
import { ThemedSelect } from '@/components';

const formSchema = object({
  name: string().optional(),
  serverId: string().optional(),
  channelId: string().when('serverId', ([serverId], schema) => {
    if (serverId) {
      return schema.required();
    }

    return schema.optional();
  }),
});

type FormData = InferType<typeof formSchema>;

interface Props {
  onUpdate: (data: FormData) => Promise<void>
  trigger: React.ReactElement
  defaultValues: Required<FormData>
}

export const EditConnectionChannelDialog: React.FC<Props> = ({
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
    watch,
  } = useForm<FormData>({
    resolver: yupResolver(formSchema),
    mode: 'all',
    defaultValues,
  });
  const serverId = watch('serverId');
  const { data, error: channelsError, status } = useDiscordServerChannels({ serverId });

  const loadingChannels = status === 'loading' || status === 'idle';

  const onSubmit = async ({ channelId, name }: FormData) => {
    await onUpdate({ channelId, name });
    onClose();
    reset({ channelId, name });
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
                <FormControl isInvalid={!!errors.name}>
                  <FormLabel>
                    {t('features.feed.components.addDiscordChannelConnectionDialog.formNameLabel')}
                  </FormLabel>
                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <Input {...field} />
                    )}
                  />
                  {errors.name && (
                  <FormErrorMessage>
                    {errors.name.message}
                  </FormErrorMessage>
                  )}
                  <FormHelperText>
                    {t('features.feed.components'
                  + '.addDiscordChannelConnectionDialog.formNameDescription')}
                  </FormHelperText>
                </FormControl>
                <FormControl isInvalid={!!errors.serverId}>
                  <FormLabel>
                    {t('features.feed.components'
                    + '.addDiscordChannelConnectionDialog.formServerLabel')}
                  </FormLabel>
                  <Controller
                    name="serverId"
                    control={control}
                    render={({ field }) => (
                      <DiscordServerSearchSelectv2
                        {...field}
                        onChange={(id) => field.onChange(id)}
                        value={field.value || ''}
                      />

                    )}
                  />
                </FormControl>
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
                        {...field}
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
