import { Button, ButtonProps, Loader } from "@chakra-ui/react";
import { forwardRef, MouseEvent, useCallback, useEffect, useRef } from "react";

/**
 * A button that never removes itself from the focus order, whether it is loading or disabled.
 *
 * Chakra's `Button` renders `disabled: loading || disabled`, i.e. a NATIVE `disabled`
 * attribute. A natively-disabled element cannot hold focus and is skipped by the tab order,
 * so a keyboard user who activates the button mid-submit has focus yanked to `<body>`, and a
 * user who tabs to a greyed-out button can never reach it to learn why it is unavailable.
 *
 * This wrapper expresses BOTH states with `aria-disabled` (never native `disabled`) plus an
 * activation guard, so the button stays focusable and assistive tech announces it as
 * unavailable. `loading` additionally sets `aria-busy` (announced as "busy") and renders the
 * spinner. Because the button is no longer natively disabled, the browser would still submit
 * the enclosing form when the user presses Enter in a sibling field, so the wrapper also
 * blocks the enclosing form's `submit` event while inactive.
 *
 * Chakra's `_disabled` recipe condition matches `[aria-disabled=true]`, so the dimmed visual
 * is preserved without the native attribute.
 */
export const SafeLoadingButton = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      loading,
      loadingText,
      spinner,
      spinnerPlacement,
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
      <Button
        ref={setRef}
        {...rest}
        aria-busy={loading || ariaBusy || undefined}
        aria-disabled={inactive || undefined}
        onClick={handleClick}
      >
        {loading ? (
          <Loader spinner={spinner} spinnerPlacement={spinnerPlacement} text={loadingText}>
            {children}
          </Loader>
        ) : (
          children
        )}
      </Button>
    );
  },
);

SafeLoadingButton.displayName = "SafeLoadingButton";
