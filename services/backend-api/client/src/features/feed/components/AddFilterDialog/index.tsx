import {
  Button,
  FormControl,
  FormHelperText,
  FormLabel,
  HStack,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Stack,
  useDisclosure,
} from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";
import { notifyError } from "@/utils/notifyError";
import { FilterCategorySelect } from "../FilterCategorySelect";

interface Props {
  onSubmit(
    data: Array<{
      category: string;
      value: string;
    }>
  ): Promise<void>;
}

export const AddFilterDialog: React.FC<Props> = ({ onSubmit }) => {
  const { t } = useTranslation();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [category, setCategory] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const onClickSave = async () => {
    if (!category || !value) {
      return;
    }

    try {
      setSaving(true);
      const mappedValues = value
        .split("\n")
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
      notifyError(t("components.addFilterDialog.failedToSaveError"), err as Error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button colorScheme="blue" isDisabled={saving} isLoading={saving} onClick={onOpen}>
        {t("components.addFilterDialog.addButton")}
      </Button>
      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>{t("components.addFilterDialog.title")}</ModalHeader>
          <ModalCloseButton />
          <ModalBody>
            <Stack spacing={3}>
              <FormControl>
                <FormLabel>{t("components.addFilterDialog.formCategoryLabel")}</FormLabel>
                <FilterCategorySelect onChangeValue={setCategory} />
                <FormHelperText>
                  {t("components.addFilterDialog.formCategoryDescription")}
                </FormHelperText>
              </FormControl>
              <FormControl>
                <FormLabel>{t("components.addFilterDialog.formValueLabel")}</FormLabel>
                <AutoResizeTextarea minH="8rem" onChange={({ target }) => setValue(target.value)} />
                <FormHelperText>
                  {t("components.addFilterDialog.formValueDescription")}
                </FormHelperText>
              </FormControl>
            </Stack>
          </ModalBody>
          <ModalFooter>
            <HStack>
              <Button onClick={onClose} isDisabled={saving} variant="ghost">
                <span>{t("components.addFilterDialog.cancel")}</span>
              </Button>
              <Button
                colorScheme="blue"
                isDisabled={saving}
                onClick={onClickSave}
                isLoading={saving}
              >
                <span>{t("components.addFilterDialog.save")}</span>
              </Button>
            </HStack>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
