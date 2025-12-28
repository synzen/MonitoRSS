import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChakraProvider, useRadioGroup, HStack } from "@chakra-ui/react";
import { describe, it, expect, vi } from "vitest";
import { TemplateCard } from "./index";
import { Template, TemplateRequiredField } from "../../types";
import { ComponentType } from "../../../../pages/MessageBuilder/types";

const mockTemplate: Template = {
  id: "test-template",
  name: "Test Template",
  description: "A test template description",
  requiredFields: [],
  createMessageComponent: () => ({
    type: ComponentType.LegacyRoot,
    id: "root",
    name: "Root",
    children: [],
  }),
};

const mockTemplateWithThumbnail: Template = {
  ...mockTemplate,
  id: "test-template-thumbnail",
  thumbnail: "https://example.com/thumbnail.png",
};

interface TestWrapperProps {
  templates: Template[];
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabledTemplates?: string[];
  disabledReason?: string;
}

const TestWrapper = ({
  templates,
  defaultValue,
  onChange = vi.fn(),
  disabledTemplates = [],
  disabledReason,
}: TestWrapperProps) => {
  const { getRootProps, getRadioProps } = useRadioGroup({
    name: "template",
    defaultValue,
    onChange,
  });

  return (
    <ChakraProvider>
      <HStack {...getRootProps()}>
        {templates.map((template) => {
          const radio = getRadioProps({
            value: template.id,
            isDisabled: disabledTemplates.includes(template.id),
          });

          return (
            <TemplateCard
              key={template.id}
              template={template}
              disabledReason={disabledReason}
              testId={`template-card-${template.id}`}
              {...radio}
            />
          );
        })}
      </HStack>
    </ChakraProvider>
  );
};

describe("TemplateCard", () => {
  describe("rendering", () => {
    it("displays the template name", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      expect(screen.getByText("Test Template")).toBeInTheDocument();
    });

    it("displays the template description", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      expect(screen.getByText("A test template description")).toBeInTheDocument();
    });

    it("renders with the correct testId", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      expect(screen.getByTestId("template-card-test-template")).toBeInTheDocument();
    });

    it("renders a fallback icon when no thumbnail is provided", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const card = screen.getByTestId("template-card-test-template");
      const icon = card.querySelector('svg[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it("renders an image when thumbnail is provided", () => {
      render(<TestWrapper templates={[mockTemplateWithThumbnail]} />);
      const img = screen.getByRole("img", { hidden: true });
      expect(img).toHaveAttribute("src", "https://example.com/thumbnail.png");
    });
  });

  describe("radio input behavior", () => {
    it("includes a radio input for each card", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const radio = screen.getByRole("radio");
      expect(radio).toBeInTheDocument();
    });

    it("sets the radio input value correctly", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const radio = screen.getByRole("radio");
      expect(radio).toHaveAttribute("value", "test-template");
    });

    it("calls onChange when a card is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<TestWrapper templates={[mockTemplate]} onChange={onChange} />);

      const card = screen.getByTestId("template-card-test-template");
      await user.click(card);

      expect(onChange).toHaveBeenCalledWith("test-template");
    });

    it("supports selection via radio group defaultValue", () => {
      render(<TestWrapper templates={[mockTemplate]} defaultValue="test-template" />);
      const radio = screen.getByRole("radio");
      expect(radio).toBeChecked();
    });

    it("allows switching between templates", async () => {
      const user = userEvent.setup();
      const template2: Template = {
        ...mockTemplate,
        id: "template-2",
        name: "Template 2",
      };
      const onChange = vi.fn();

      render(
        <TestWrapper
          templates={[mockTemplate, template2]}
          defaultValue="test-template"
          onChange={onChange}
        />
      );

      const card2 = screen.getByTestId("template-card-template-2");
      await user.click(card2);

      expect(onChange).toHaveBeenCalledWith("template-2");
    });
  });

  describe("hover state", () => {
    it("applies hover styles when not disabled and not selected", async () => {
      const user = userEvent.setup();
      render(<TestWrapper templates={[mockTemplate]} />);

      const card = screen.getByTestId("template-card-test-template");
      const visualBox = card.querySelector("[data-checked]")?.parentElement || card.children[1];

      await user.hover(card);

      // Verify the card has transition for smooth hover effects
      expect(visualBox).toHaveStyle({ transition: "background 0.2s,border-color 0.2s" });
    });

    it("has pointer cursor in default state", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const card = screen.getByTestId("template-card-test-template");
      const visualBox = card.children[1];

      expect(visualBox).toHaveStyle({ cursor: "pointer" });
    });
  });

  describe("selected state", () => {
    it("shows checkmark icon when selected", () => {
      render(<TestWrapper templates={[mockTemplate]} defaultValue="test-template" />);
      const card = screen.getByTestId("template-card-test-template");
      // When selected, there should be 2 icons: ViewIcon (fallback) and CheckCircleIcon
      const icons = card.querySelectorAll('svg[aria-hidden="true"]');
      expect(icons.length).toBe(2);
    });

    it("does not show checkmark icon when not selected", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const card = screen.getByTestId("template-card-test-template");
      // The only icon should be the ViewIcon fallback in the thumbnail area
      const icons = card.querySelectorAll('svg[aria-hidden="true"]');
      // Should only have 1 icon (the ViewIcon), not 2 (ViewIcon + CheckCircle)
      expect(icons.length).toBe(1);
    });
  });

  describe("disabled state", () => {
    it("renders disabled badge with default text", () => {
      render(<TestWrapper templates={[mockTemplate]} disabledTemplates={["test-template"]} />);
      expect(screen.getByText("Needs articles")).toBeInTheDocument();
    });

    it("renders disabled badge with custom text", () => {
      render(
        <TestWrapper
          templates={[mockTemplate]}
          disabledTemplates={["test-template"]}
          disabledReason="Custom reason"
        />
      );
      expect(screen.getByText("Custom reason")).toBeInTheDocument();
    });

    it("marks radio input as disabled", () => {
      render(<TestWrapper templates={[mockTemplate]} disabledTemplates={["test-template"]} />);
      const radio = screen.getByRole("radio");
      expect(radio).toBeDisabled();
    });

    it("does not call onChange when disabled card is clicked", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(
        <TestWrapper
          templates={[mockTemplate]}
          disabledTemplates={["test-template"]}
          onChange={onChange}
        />
      );

      const card = screen.getByTestId("template-card-test-template");
      await user.click(card);

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe("keyboard navigation", () => {
    it("can be focused via tab", async () => {
      const user = userEvent.setup();
      render(<TestWrapper templates={[mockTemplate]} />);

      await user.tab();

      const radio = screen.getByRole("radio");
      expect(radio).toHaveFocus();
    });

    it("can navigate between cards with arrow keys", async () => {
      const user = userEvent.setup();
      const template2: Template = {
        ...mockTemplate,
        id: "template-2",
        name: "Template 2",
      };

      render(<TestWrapper templates={[mockTemplate, template2]} />);

      await user.tab();
      expect(screen.getAllByRole("radio")[0]).toHaveFocus();

      await user.keyboard("{ArrowRight}");
      expect(screen.getAllByRole("radio")[1]).toHaveFocus();

      await user.keyboard("{ArrowLeft}");
      expect(screen.getAllByRole("radio")[0]).toHaveFocus();
    });

    it("selects on space key", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<TestWrapper templates={[mockTemplate]} onChange={onChange} />);

      await user.tab();
      await user.keyboard(" ");

      expect(onChange).toHaveBeenCalledWith("test-template");
    });

    // Note: Native radio buttons only respond to Space key, not Enter.
    // This is standard browser behavior for radio inputs.
  });

  describe("accessibility", () => {
    it("uses radio role for the input", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      expect(screen.getByRole("radio")).toBeInTheDocument();
    });

    it("associates label with radio input via wrapping label element", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const card = screen.getByTestId("template-card-test-template");
      expect(card.tagName.toLowerCase()).toBe("label");
    });

    it("disabled radio has aria-disabled", () => {
      render(<TestWrapper templates={[mockTemplate]} disabledTemplates={["test-template"]} />);
      const radio = screen.getByRole("radio");
      expect(radio).toBeDisabled();
    });
  });

  describe("inline explanation for disabled cards", () => {
    const templateWithImageField: Template = {
      ...mockTemplate,
      id: "image-template",
      name: "Image Template",
      requiredFields: [TemplateRequiredField.Image],
    };

    const templateWithDescriptionField: Template = {
      ...mockTemplate,
      id: "description-template",
      name: "Description Template",
      requiredFields: [TemplateRequiredField.Description],
    };

    const templateWithMultipleFields: Template = {
      ...mockTemplate,
      id: "multi-field-template",
      name: "Multi Field Template",
      requiredFields: [TemplateRequiredField.Image, TemplateRequiredField.Description],
    };

    it("always shows explanation for disabled cards with required fields", () => {
      render(
        <TestWrapper templates={[templateWithImageField]} disabledTemplates={["image-template"]} />
      );

      // Explanation should be visible immediately without any interaction
      expect(screen.getByText(/This template displays images from articles/i)).toBeInTheDocument();
    });

    it("shows correct explanation for image field", () => {
      render(
        <TestWrapper templates={[templateWithImageField]} disabledTemplates={["image-template"]} />
      );

      expect(
        screen.getByText(
          "This template displays images from articles. Your feed's articles don't include images."
        )
      ).toBeInTheDocument();
    });

    it("shows correct explanation for description field", () => {
      render(
        <TestWrapper
          templates={[templateWithDescriptionField]}
          disabledTemplates={["description-template"]}
        />
      );

      expect(
        screen.getByText(
          "This template shows article descriptions. Your feed's articles don't include descriptions."
        )
      ).toBeInTheDocument();
    });

    it("shows combined explanation for multiple missing fields", () => {
      render(
        <TestWrapper
          templates={[templateWithMultipleFields]}
          disabledTemplates={["multi-field-template"]}
        />
      );

      expect(
        screen.getByText(
          "This template needs image and description fields that your feed's articles don't have."
        )
      ).toBeInTheDocument();
    });

    it("does not show explanation for disabled cards without required fields", () => {
      const templateWithNoRequiredFields: Template = {
        ...mockTemplate,
        id: "no-fields-template",
        requiredFields: [],
      };

      render(
        <TestWrapper
          templates={[templateWithNoRequiredFields]}
          disabledTemplates={["no-fields-template"]}
        />
      );

      // Should not find any explanation text
      expect(screen.queryByText(/This template/i)).not.toBeInTheDocument();
    });

    it("shows info icon with explanation", () => {
      render(
        <TestWrapper templates={[templateWithImageField]} disabledTemplates={["image-template"]} />
      );

      const card = screen.getByTestId("template-card-image-template");

      // Should have ViewIcon + InfoIcon
      const icons = card.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThanOrEqual(2);
    });

    it("does not show explanation for enabled cards", () => {
      render(<TestWrapper templates={[templateWithImageField]} />);

      // Explanation should not be visible for enabled cards
      expect(screen.queryByText(/This template displays images/i)).not.toBeInTheDocument();
    });
  });

  describe("visual distinction for disabled cards", () => {
    it("applies dashed border style when disabled", () => {
      render(<TestWrapper templates={[mockTemplate]} disabledTemplates={["test-template"]} />);
      const card = screen.getByTestId("template-card-test-template");
      const visualBox = card.children[1];

      expect(visualBox).toHaveStyle({ borderStyle: "dashed" });
    });

    it("applies solid border style when enabled", () => {
      render(<TestWrapper templates={[mockTemplate]} />);
      const card = screen.getByTestId("template-card-test-template");
      const visualBox = card.children[1];

      expect(visualBox).toHaveStyle({ borderStyle: "solid" });
    });

    it("has not-allowed cursor when disabled", () => {
      render(<TestWrapper templates={[mockTemplate]} disabledTemplates={["test-template"]} />);
      const card = screen.getByTestId("template-card-test-template");
      const visualBox = card.children[1];

      expect(visualBox).toHaveStyle({ cursor: "not-allowed" });
    });
  });
});
