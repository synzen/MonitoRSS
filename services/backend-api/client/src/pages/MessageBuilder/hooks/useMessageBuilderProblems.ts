import { useMemo, useState, useCallback } from "react";
import { FieldError, FieldErrorsImpl, Merge } from "react-hook-form";
import type { MessageBuilderProblem, MessageComponentRoot } from "../types";
import extractMessageBuilderProblems from "../utils/extractMessageBuilderProblems";
import extractResolutionWarnings from "../utils/extractResolutionWarnings";

type ResolvedMessage = Record<string, any>;

const useMessageBuilderProblems = (
  formStateErrors: Merge<FieldError, FieldErrorsImpl<any>> | undefined,
  messageComponent?: MessageComponentRoot,
) => {
  const [resolvedMessages, setResolvedMessages] = useState<ResolvedMessage[]>([]);

  const errors = useMemo(
    () => extractMessageBuilderProblems(formStateErrors, messageComponent),
    [formStateErrors, messageComponent],
  );

  const warnings = useMemo(
    () => extractResolutionWarnings(messageComponent, resolvedMessages),
    [messageComponent, resolvedMessages],
  );

  const allProblems = useMemo(() => [...errors, ...warnings], [errors, warnings]);

  const componentIdsWithErrors = useMemo(() => new Set(errors.map((p) => p.componentId)), [errors]);

  const componentIdsWithWarnings = useMemo(
    () => new Set(warnings.map((p) => p.componentId)),
    [warnings],
  );

  return {
    errors,
    warnings,
    allProblems,
    componentIdsWithErrors,
    componentIdsWithWarnings,
    setResolvedMessages,
  };
};

export default useMessageBuilderProblems;
