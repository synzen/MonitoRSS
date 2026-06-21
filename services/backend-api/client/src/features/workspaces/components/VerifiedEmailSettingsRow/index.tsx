import { useState } from "react";
import { Button, HStack, Input } from "@chakra-ui/react";
import { Field } from "@/components/ui/field";
import { useUserMe } from "@/features/discordUser";
import { useIsWorkspacesEnabled, useWorkspaces } from "../../hooks";
import { ChangeVerifiedEmailDialog } from "../ChangeVerifiedEmailDialog";

interface Props {
  onChanged: () => void;
}

// The verified-email row plus its change-email dialog, gated to workspace-enabled
// users. Self-contained so the settings page does not need to know the gating
// rule or own the dialog open state.
export const VerifiedEmailSettingsRow = ({ onChanged }: Props) => {
  const { enabled } = useIsWorkspacesEnabled();
  const { data } = useUserMe();
  const { workspaces } = useWorkspaces();
  const [isOpen, setIsOpen] = useState(false);

  if (!enabled) {
    return null;
  }

  const verifiedEmail = data?.result.verifiedEmail;
  const ownsWorkspace = !!workspaces?.some((w) => w.role === "owner");
  const helperText = ownsWorkspace
    ? "Used for workspace invitations, member notices, and billing for the workspaces you own. Change it to verify a different address you own."
    : "Used for workspace invitations and member notices. Change it to verify a different address you own.";

  return (
    <>
      <Field label="Verified workspace email" helperText={helperText}>
        <HStack gap={2} alignSelf="stretch" alignItems="center">
          <Input flex="1" readOnly value={verifiedEmail || "(no verified email)"} />
          <Button variant="plain" color="text.link" onClick={() => setIsOpen(true)}>
            Change email
          </Button>
        </HStack>
      </Field>
      <ChangeVerifiedEmailDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentEmail={verifiedEmail || ""}
        onChanged={onChanged}
      />
    </>
  );
};
