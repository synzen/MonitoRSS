import { IconButton, IconButtonProps, Spinner } from "@chakra-ui/react";
import { forwardRef, MouseEvent, useCallback, useEffect, useRef } from "react";

/**
 * The {@link SafeLoadingButton} counterpart for icon buttons.
 *
 * Chakra's `IconButton` natively `disabled`s itself while `loading` or `disabled`, which both
 * removes the button from the tab order and yanks keyboard focus to `<body>` mid-action. This
 * wrapper expresses BOTH states with `aria-disabled` (never native `disabled`) plus an
 * activation guard, so the button stays focusable and assistive tech announces it as
 * unavailable. `loading` additionally sets `aria-busy` and swaps the icon for a spinner.
 * Because the button is no longer natively disabled, the wrapper also blocks the enclosing
 * form's `submit` event while inactive.
 */
export const SafeLoadingIconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      loading,
      disabled,
      onClick,
      children,
      "aria-busy": ariaBusy,
      "aria-disabled": ariaDisabled,
      ...rest
    },
    ref,
  ) => {
    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const inactive = loading || disabled || ariaDisabled;

    const setRef = useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;

        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          // eslint-disable-next-line no-param-reassign
          ref.current = node;
        }
      },
      [ref],
    );

    useEffect(() => {
      const form = buttonRef.current?.form;

      if (!inactive || !form) {
        return undefined;
      }

      const blockSubmit = (e: Event) => e.preventDefault();

      form.addEventListener("submit", blockSubmit, true);

      return () => form.removeEventListener("submit", blockSubmit, true);
    }, [inactive]);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      if (inactive) {
        e.preventDefault();

        return;
      }

      onClick?.(e);
    };

    return (
      <IconButton
        ref={setRef}
        {...rest}
        aria-busy={loading || ariaBusy || undefined}
        aria-disabled={inactive || undefined}
        onClick={handleClick}
      >
        {loading ? <Spinner /> : children}
      </IconButton>
    );
  },
);

SafeLoadingIconButton.displayName = "SafeLoadingIconButton";
