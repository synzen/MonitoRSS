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
              away from. The underlying step refetches user-me on confirm.
              Keyed on `isOpen` so a sent-but-unconfirmed attempt does not persist
              into the next open: the dialog stays mounted while closed, so without
              a fresh key the step would reopen on its code-entry screen. (Ark's
              `unmountOnExit` only unmounts on the exit-animation end, which doesn't
              reset synchronously, so the explicit key is the reliable reset here.)
              VerifyEmailStep owns its own polite live region for send/verify
              status, so the dialog adds none. */}
          <VerifyEmailStep
            key={isOpen ? "open" : "closed"}
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
        </DialogBody>
      </DialogContent>
    </DialogRoot>
  );
};
