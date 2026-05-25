import { useState, useEffect, useRef, useCallback } from "react";
import * as yup from "yup";
import { MessageComponentRoot } from "../types";
import createMessageBuilderComponentSchema from "../utils/createMessageBuilderComponentSchema";
import { transformYupErrors } from "./transformYupErrors";

const validationSchema = yup.object({
  messageComponent: createMessageBuilderComponentSchema().optional(),
});

export function useMessageBuilderValidation(messageComponent: MessageComponentRoot | undefined) {
  const [errors, setErrors] = useState<Record<string, any>>({});
  const validationVersion = useRef(0);

  useEffect(() => {
    validationVersion.current += 1;
    const capturedVersion = validationVersion.current;
    let cancelled = false;

    (async () => {
      if (!messageComponent) {
        setErrors({});

        return;
      }

      try {
        await validationSchema.validate({ messageComponent }, { abortEarly: false });
        if (!cancelled && capturedVersion === validationVersion.current) {
          setErrors({});
        }
      } catch (err) {
        if (!cancelled && capturedVersion === validationVersion.current) {
          if (err instanceof yup.ValidationError) {
            setErrors(transformYupErrors(err.inner));
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messageComponent]);

  const validate = useCallback(async (): Promise<boolean> => {
    if (!messageComponent) {
      setErrors({});

      return true;
    }

    try {
      await validationSchema.validate({ messageComponent }, { abortEarly: false });
      setErrors({});

      return true;
    } catch (err) {
      if (err instanceof yup.ValidationError) {
        setErrors(transformYupErrors(err.inner));
      }

      return false;
    }
  }, [messageComponent]);

  return { errors, validate };
}
