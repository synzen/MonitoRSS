import { useTranslation } from "react-i18next";
import { InlineErrorAlert, InlineErrorIncompleteFormAlert } from "../../../../components";

export interface ConnectionDialogErrorDisplayProps {
  error: Error | null;
  isSubmitted: boolean;
  formErrorCount: number;
}

export const ConnectionDialogErrorDisplay: React.FC<ConnectionDialogErrorDisplayProps> = ({
  error,
  isSubmitted,
  formErrorCount,
}) => {
  const { t } = useTranslation();

  return (
    <>
      {error && (
        <InlineErrorAlert
          title={t("common.errors.somethingWentWrong")}
          description={error.message}
        />
      )}
      {isSubmitted && formErrorCount > 0 && (
        <InlineErrorIncompleteFormAlert fieldCount={formErrorCount} />
      )}
    </>
  );
};
