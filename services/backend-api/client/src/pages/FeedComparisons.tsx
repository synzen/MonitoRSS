import {
  FormControl,
  Heading,
  Stack,
  Button,
  HStack,
  Text,
  FormHelperText,
} from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { isEqual } from "lodash";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DashboardContent } from "@/components";
import RouteParams from "../types/RouteParams";
import { FeedRawDumpButton, useFeed } from "@/features/feed";
import { ErrorAlert } from "@/components/ErrorAlert";
import { useUpdateFeed } from "@/features/feed/hooks/useUpdateFeed";
import { notifyError } from "@/utils/notifyError";
import { AutoResizeTextarea } from "@/components/AutoResizeTextarea";

interface FormState {
  pcomparisons: string;
  ncomparisons: string;
}

const FeedComparisons: React.FC = () => {
  const { feedId } = useParams<RouteParams>();
  const { t } = useTranslation();
  const { status, feed, error } = useFeed({
    feedId,
  });
  const { mutateAsync } = useUpdateFeed();
  const [formState, setFormState] = useState<FormState>({
    ncomparisons: "",
    pcomparisons: "",
  });
  const [saving, setSaving] = useState(false);

  const formIsDifferent = !isEqual(
    [
      [
        ...formState.ncomparisons
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .sort(),
      ],
      [
        ...formState.pcomparisons
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .sort(),
      ],
    ],
    [[...(feed?.ncomparisons?.sort() || [])], [...(feed?.pcomparisons?.sort() || [])]]
  );

  const resetForm = () => {
    if (!feed) {
      return;
    }

    setFormState({
      ncomparisons: feed.ncomparisons.join("\n"),
      pcomparisons: feed.pcomparisons.join("\n"),
    });
  };

  useEffect(() => {
    resetForm();
  }, [feed]);

  if (error) {
    return <ErrorAlert description={error.message} />;
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!feedId) {
      return;
    }

    try {
      setSaving(true);
      const response = await mutateAsync({
        feedId,
        details: {
          ncomparisons: formState.ncomparisons
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .sort(),
          pcomparisons: formState.pcomparisons
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
            .sort(),
        },
      });

      setFormState({
        ncomparisons: response.result.ncomparisons.join("\n"),
        pcomparisons: response.result.pcomparisons.join("\n"),
      });
    } catch (err) {
      notifyError(t("common.errors.failedToSave"), err as Error);
    } finally {
      setSaving(false);
    }
  };

  const onChangeNcomparisons = (ncomparisonsInput: string) => {
    setFormState({
      ...formState,
      ncomparisons: ncomparisonsInput,
    });
  };

  const onChangePcomparisons = (pcomparisonsInput: string) => {
    setFormState({
      ...formState,
      pcomparisons: pcomparisonsInput,
    });
  };

  return (
    <DashboardContent loading={status === "loading"}>
      <Stack spacing={8}>
        <Stack>
          <Heading>{t("pages.comparisons.title")}</Heading>
          <Text>{t("pages.comparisons.description")}</Text>
        </Stack>
        <FeedRawDumpButton feedId={feedId} />
        <form onSubmit={onSubmit}>
          <Stack spacing={4}>
            <Stack>
              <Heading size="md">{t("pages.comparisons.passingComparisonsTitle")}</Heading>
              <Text>{t("pages.comparisons.passingComparisonsDescription")}</Text>
            </Stack>
            <FormControl>
              {/* <FormLabel>
                {t('pages.comparisons.passingComparisonsTitle')}
              </FormLabel> */}
              <AutoResizeTextarea
                minRows={5}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                value={formState.pcomparisons}
                onChange={(e) => {
                  onChangePcomparisons(e.target.value);
                }}
              />
              <FormHelperText>{t("pages.comparisons.comparisonsInputHelperText")}</FormHelperText>
            </FormControl>
            <Stack>
              <Heading size="md">{t("pages.comparisons.blockingComparisonsTitle")}</Heading>
              <Text>{t("pages.comparisons.blockingComparisonsDescription")}</Text>
            </Stack>
            <FormControl>
              {/* <FormLabel>
                {t('pages.comparisons.blockingComparisonsTitle')}
              </FormLabel> */}
              <AutoResizeTextarea
                minRows={5}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                value={formState.ncomparisons}
                onChange={(e) => {
                  onChangeNcomparisons(e.target.value);
                }}
              />
              <FormHelperText>{t("pages.comparisons.comparisonsInputHelperText")}</FormHelperText>
            </FormControl>
          </Stack>
          <HStack marginTop="4" justifyContent="flex-end">
            <Button variant="ghost" onClick={resetForm} isDisabled={!formIsDifferent || saving}>
              {t("pages.comparisons.resetButtonLabel")}
            </Button>
            <Button
              colorScheme="blue"
              isLoading={saving}
              type="submit"
              isDisabled={!formIsDifferent || saving}
            >
              <span>{t("pages.comparisons.saveButtonLabel")}</span>
            </Button>
          </HStack>
        </form>
      </Stack>
    </DashboardContent>
  );
};

export default FeedComparisons;
