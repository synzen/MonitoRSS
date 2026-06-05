import React, { ComponentProps, Fragment } from "react";
import { Button, Icon } from "@chakra-ui/react";
import { FaPlus } from "react-icons/fa6";
import {
  MenuRoot,
  MenuTrigger,
  MenuContent,
  MenuItem,
  MenuItemGroup,
  MenuSeparator,
} from "@/components/ui/menu";
import { Tooltip } from "@/components/ui/tooltip";
import type { Component } from "./types";
import { ComponentType } from "./types";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";
import {
  COMPONENT_CHILD_RULES,
  getGroupCount,
  isChildRuleAtLimit,
} from "./constants/componentChildRules";

interface AddComponentButtonProps {
  component: Component;
  canHaveChildren: boolean;
  onAddChild: (childType: ComponentType, isAccessory?: boolean) => void;
  buttonProps?: ComponentProps<typeof Button>;
}

export const AddComponentButton: React.FC<AddComponentButtonProps> = ({
  component,
  canHaveChildren,
  onAddChild,
  buttonProps,
}) => {
  const groups = COMPONENT_CHILD_RULES[component.type] ?? [];

  return (
    <MenuRoot>
      <Tooltip disabled={canHaveChildren} content={"This component can't have any subcomponents."}>
        <MenuTrigger asChild>
          <Button
            aria-disabled={!canHaveChildren}
            size="2xs"
            data-tour-target="add-component-button"
            variant="solid"
            // White-on-blue: this button only ever appears on the selected (blue.600) tree row, so a
            // blue solid would be blue-on-blue. fg/bg invert correctly in light mode.
            bg="fg"
            color="bg"
            _hover={{ bg: "fg.muted" }}
            aria-label={`Add new component under ${getMessageBuilderComponentLabel(component.type)}`}
            onClick={canHaveChildren ? undefined : (e) => e.preventDefault()}
            // Only block activation keys — allow Tab and other navigation keys through
            onKeyDown={
              canHaveChildren
                ? undefined
                : (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                    }
                  }
            }
            {...buttonProps}
          >
            <Icon as={FaPlus} />
            New Component
          </Button>
        </MenuTrigger>
      </Tooltip>
      <MenuContent borderColor="border">
        {groups.map((group, groupIndex) => {
          const title = group.showCount
            ? `${group.title} (${getGroupCount(component, group)}/${group.rules[0].max})`
            : group.title;

          return (
            <Fragment key={group.title}>
              {groupIndex > 0 && <MenuSeparator />}
              <MenuItemGroup title={title}>
                {group.rules.map((rule) => (
                  <MenuItem
                    key={rule.value}
                    value={rule.value}
                    color="fg"
                    onClick={() => onAddChild(rule.type, rule.isAccessory)}
                    disabled={isChildRuleAtLimit(component, rule)}
                  >
                    {rule.addLabel}
                  </MenuItem>
                ))}
              </MenuItemGroup>
            </Fragment>
          );
        })}
      </MenuContent>
    </MenuRoot>
  );
};
