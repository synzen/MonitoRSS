import { useFormContext } from "react-hook-form";
import { Button, HStack, Icon, Text, VisuallyHidden, chakra } from "@chakra-ui/react";
import { FaCircleInfo } from "react-icons/fa6";
import { motion } from "motion/react";
import { isEqual } from "lodash";
import { RefObject, useEffect, useRef, useState } from "react";
import { AnimatedComponent } from "../AnimatedComponent";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

const MotionDiv = chakra(motion.div);

/**
 * After a successful save the bar unmounts, so the keyboard user's focus (on the Save
 * button) would fall to `<body>`. Move it to a stable region so focus stays in the content
 * the user was editing. The target is made programmatically focusable (tabindex=-1) without
 * entering the tab order.
 */
const restoreFocus = (target: HTMLElement | null) => {
  if (!target) {
    return;
  }

  if (!target.hasAttribute("tabindex")) {
    target.setAttribute("tabindex", "-1");
  }

  target.focus();
};

interface Props {
  /**
   * react-hook-form isDirty does not report true in some cases
   * such as when setting an empty array for a field that was previously
   * populated (happens with custom placeholders)
   */
  useDirtyFormCheck?: boolean;
  /**
   * Element to move keyboard focus to after a successful save (when the bar unmounts), so
   * focus never drops to `<body>`. Pass the form/tab-content region the user was editing.
   * Required: every consumer must decide where focus lands.
   */
  restoreFocusRef: RefObject<HTMLElement>;
}

export const SavedUnsavedChangesPopupBar = ({ useDirtyFormCheck, restoreFocusRef }: Props) => {
  const {
    formState: { isSubmitting, isValid, defaultValues, isDirty: formContextIsDirty },
    reset,
    getValues,
  } = useFormContext();

  const isDirty = useDirtyFormCheck ? formContextIsDirty : !isEqual(getValues(), defaultValues);

  const wasSubmitting = useRef(false);
  const [savedAnnouncement, setSavedAnnouncement] = useState("");

  useEffect(() => {
    if (wasSubmitting.current && !isSubmitting && !isDirty) {
      restoreFocus(restoreFocusRef.current);
      setSavedAnnouncement("Changes saved.");
      const timer = setTimeout(() => setSavedAnnouncement(""), 1000);

      wasSubmitting.current = isSubmitting;

      return () => clearTimeout(timer);
    }

    wasSubmitting.current = isSubmitting;

    return undefined;
  }, [isSubmitting, isDirty]);

  return (
    <>
      <VisuallyHidden>
        <div role="status" aria-live="polite" aria-atomic="true">
          {savedAnnouncement}
        </div>
      </VisuallyHidden>
      <AnimatedComponent>
        {isDirty && (
          <MotionDiv
            display="flex"
            flexDirection="row-reverse"
            position="fixed"
            bottom="-100px"
            left="50%"
            opacity="0"
            zIndex={100}
            transform="translate(-50%, -50%)"
            width={["90%", "90%", "80%", "80%", "1200px"]}
            borderRadius="l3"
            paddingX={4}
            paddingY={2}
            bg="bg.emphasized"
            borderWidth="1px"
            borderColor="border.emphasized"
            borderLeftWidth="4px"
            borderLeftColor="brandSolid"
            boxShadow="xl"
            animate={{ opacity: 1, bottom: "0px" }}
            exit={{ opacity: 0, bottom: "-100px" }}
          >
            <HStack justifyContent="space-between" width="100%" flexWrap="wrap" gap={4}>
              <HStack gap={2}>
                <Icon as={FaCircleInfo} color="text.link" aria-hidden />
                <Text>You have unsaved changes on this page!</Text>
              </HStack>
              <HStack flexWrap="wrap">
                <Button
                  onClick={() => reset(defaultValues)}
                  variant="outline"
                  disabled={!isDirty || isSubmitting}
                >
                  <span>Discard all changes</span>
                </Button>
                <PrimaryActionButton
                  type="submit"
                  disabled={!isDirty || !isValid}
                  loading={isSubmitting}
                >
                  <span>Save all changes</span>
                </PrimaryActionButton>
              </HStack>
            </HStack>
          </MotionDiv>
        )}
      </AnimatedComponent>
    </>
  );
};
