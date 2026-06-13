import { VisuallyHidden } from "@chakra-ui/react";
import {
  DialogRoot,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogCloseTrigger,
} from "@/components/ui/dialog";
import { VerifyEmailStep } from "../VerifyEmailStep";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onChanged: () => void;
}

export const ChangeVerifiedEmailDialog = ({ isOpen, onClose, currentEmail, onChanged }: Props) => {
  return (
    <DialogRoot open={isOpen} onOpenChange={(e) => !e.open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change verified email</DialogTitle>
        </DialogHeader>
        <DialogCloseTrigger />
        <DialogBody>
          {/* Empty field by default, current address shown as context in the
              intro so the user is not forced to clear a value they're moving
              away from. The underlying step refetches user-me on confirm. */}
          <VerifyEmailStep
            onVerified={() => {
              onChanged();
              onClose();
            }}
            intro={
              <>
                Your current verified email is <strong>{currentEmail}</strong>. Enter a new address
                to verify. We&apos;ll send a one-time code to confirm you own it.
              </>
            }
          />
          <VisuallyHidden aria-live="polite" />
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
