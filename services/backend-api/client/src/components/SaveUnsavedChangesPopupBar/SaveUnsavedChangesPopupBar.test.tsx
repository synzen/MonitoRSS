import { useRef } from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider } from "@chakra-ui/react";
import { FormProvider, useForm, useFormState } from "react-hook-form";
import { describe, it, expect } from "vitest";
import { system } from "@/utils/theme";
import { SavedUnsavedChangesPopupBar } from "./index";

const Harness = ({ onSubmit }: { onSubmit: () => Promise<void> | void }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const methods = useForm({ defaultValues: { name: "" }, mode: "all" });

  const submit = methods.handleSubmit(async (values) => {
    await onSubmit();
    methods.reset(values);
  });

  return (
    <ChakraProvider value={system}>
      <FormProvider {...methods}>
        <form ref={formRef} onSubmit={submit} aria-label="Test form">
          <input aria-label="Name" {...methods.register("name")} />
          {/* Mirrors a real consumer form that subscribes to form state, so RHF's lazy
              proxy flushes the isSubmitting transition the bar reacts to. */}
          <FormStateSubscriber />
          <SavedUnsavedChangesPopupBar useDirtyFormCheck restoreFocusRef={formRef} />
        </form>
      </FormProvider>
    </ChakraProvider>
  );
};

const FormStateSubscriber = () => {
  useFormState();

  return null;
};

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

describe("SavedUnsavedChangesPopupBar", () => {
  it("shows the bar only once the form is dirty", async () => {
    render(<Harness onSubmit={() => delay(10)} />);

    expect(screen.queryByText("You have unsaved changes on this page!")).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Name"), "a");

    expect(screen.getByText("You have unsaved changes on this page!")).toBeInTheDocument();
  });

  it("has a persistent polite status region for announcements", () => {
    render(<Harness onSubmit={() => {}} />);

    const status = screen.getByRole("status");

    expect(status).toHaveAttribute("aria-live", "polite");
    expect(status).toBeEmptyDOMElement();
  });

  it("announces 'Changes saved.' and restores focus after a successful save", async () => {
    render(<Harness onSubmit={() => delay(20)} />);

    await userEvent.type(screen.getByLabelText("Name"), "a");
    await userEvent.click(screen.getByText("Save all changes").closest("button")!);
    await act(async () => {
      await delay(60);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Changes saved.");
    expect(screen.getByRole("form", { name: "Test form" })).toHaveFocus();
  });
});
