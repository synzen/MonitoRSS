import React, { ComponentProps } from "react";
import {
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  MenuGroup,
  MenuDivider,
  Tooltip,
  Button,
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import type { Component } from "./types";
import { ComponentType } from "./types";
import getMessageBuilderComponentLabel from "./utils/getMessageBuilderComponentLabel";

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
  return (
    <Menu>
      <Tooltip isDisabled={canHaveChildren} label={"This component can't have any subcomponents."}>
        <MenuButton
          aria-disabled={!canHaveChildren}
          as={Button}
          leftIcon={<AddIcon />}
          size="xs"
          data-tour-target="add-component-button"
          variant="solid"
          colorScheme="twitter"
          aria-label={`Add new component under ${getMessageBuilderComponentLabel(component.type)}`}
          onClick={canHaveChildren ? undefined : (e) => e.preventDefault()}
          onKeyDown={canHaveChildren ? undefined : (e) => e.preventDefault()}
          {...buttonProps}
        >
          New Component
        </MenuButton>
      </Tooltip>
      <MenuList bg="gray.700" borderColor="gray.600">
        {component.type === ComponentType.LegacyRoot && (
          <>
            <MenuGroup
              title={`Text (${
                component.children?.filter((c) => c.type === ComponentType.LegacyText).length || 0
              }/1)`}
            >
              <MenuItem
                color="white"
                onClick={() => onAddChild(ComponentType.LegacyText)}
                isDisabled={component.children?.some((c) => c.type === ComponentType.LegacyText)}
              >
                Add {getMessageBuilderComponentLabel(ComponentType.LegacyText)}
              </MenuItem>
            </MenuGroup>
            <MenuDivider />
            <MenuGroup
              title={`${getMessageBuilderComponentLabel(ComponentType.LegacyEmbedContainer)} (${
                component.children?.filter((c) => c.type === ComponentType.LegacyEmbedContainer)
                  .length || 0
              }/1)`}
            >
              <MenuItem
                color="white"
                onClick={() => onAddChild(ComponentType.LegacyEmbedContainer)}
                isDisabled={component.children?.some(
                  (c) => c.type === ComponentType.LegacyEmbedContainer
                )}
              >
                Add {getMessageBuilderComponentLabel(ComponentType.LegacyEmbedContainer)}
              </MenuItem>
            </MenuGroup>
            <MenuDivider />
            <MenuGroup
              title={`Action Rows (${
                component.children?.filter((c) => c.type === ComponentType.LegacyActionRow)
                  .length || 0
              }/5)`}
            >
              <MenuItem
                color="white"
                onClick={() => onAddChild(ComponentType.LegacyActionRow)}
                isDisabled={
                  (component.children?.filter((c) => c.type === ComponentType.LegacyActionRow)
                    .length || 0) >= 5
                }
              >
                Add {getMessageBuilderComponentLabel(ComponentType.LegacyActionRow)}
              </MenuItem>
            </MenuGroup>
          </>
        )}
        {component.type === ComponentType.LegacyEmbed && (
          <MenuGroup title="Embed Components">
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedAuthor)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedAuthor
              )}
            >
              Add Author
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedTitle)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedTitle
              )}
            >
              Add Title
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedDescription)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedDescription
              )}
            >
              Add Description
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedImage)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedImage
              )}
            >
              Add Image
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedThumbnail)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedThumbnail
              )}
            >
              Add Thumbnail
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedFooter)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedFooter
              )}
            >
              Add Footer
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedTimestamp)}
              isDisabled={component.children?.some(
                (c) => c.type === ComponentType.LegacyEmbedTimestamp
              )}
            >
              Add Timestamp
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.LegacyEmbed && <MenuDivider />}
        {component.type === ComponentType.LegacyEmbed && (
          <MenuGroup
            title={`Embed Fields (${
              component.children?.filter((c) => c.type === ComponentType.LegacyEmbedField).length ||
              0
            }/25)`}
          >
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbedField)}
              isDisabled={
                (component.children?.filter((c) => c.type === ComponentType.LegacyEmbedField)
                  .length || 0) >= 25
              }
            >
              Add Field
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.LegacyEmbedContainer && (
          <MenuGroup title={`Embeds (${component.children?.length || 0}/9)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyEmbed)}
              isDisabled={(component.children?.length || 0) >= 9}
            >
              Add Embed
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.LegacyActionRow && (
          <MenuGroup title={`Buttons (${component.children?.length || 0}/5)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.LegacyButton)}
              isDisabled={(component.children?.length || 0) >= 5}
            >
              Add Button
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2Root && (
          <MenuGroup title={`Components (${component.children?.length || 0}/10)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2ActionRow)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Action Row
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Section)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Section
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Divider)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Divider
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Container)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Container
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2Container && (
          <MenuGroup title={`Components (${component.children?.length || 0}/10)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Section)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Section
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2ActionRow)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Action Row
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2TextDisplay)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Text Display
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2MediaGallery)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Media Gallery
            </MenuItem>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Divider)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Divider
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2ActionRow && (
          <MenuGroup title={`Buttons (${component.children?.length || 0}/5)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2Button)}
              isDisabled={(component.children?.length || 0) >= 5}
            >
              Add Button
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2MediaGallery && (
          <MenuGroup title={`Gallery Items (${component.children?.length || 0}/10)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2MediaGalleryItem)}
              isDisabled={(component.children?.length || 0) >= 10}
            >
              Add Gallery Item
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2Section && (
          <MenuGroup title={`Text Displays (${component.children?.length || 0}/3)`}>
            <MenuItem
              color="white"
              onClick={() => onAddChild(ComponentType.V2TextDisplay)}
              isDisabled={(component.children?.length || 0) >= 3}
            >
              Add Text Display
            </MenuItem>
          </MenuGroup>
        )}
        {component.type === ComponentType.V2Section && (
          <>
            <MenuDivider />
            <MenuGroup title={`Accessory (${(component as any).accessory ? 1 : 0}/1)`}>
              <MenuItem
                color="white"
                onClick={() => onAddChild(ComponentType.V2Button, true)}
                isDisabled={!!(component as any).accessory}
              >
                Add Button Accessory
              </MenuItem>
              <MenuItem
                color="white"
                onClick={() => onAddChild(ComponentType.V2Thumbnail, true)}
                isDisabled={!!(component as any).accessory}
              >
                Add Thumbnail Accessory
              </MenuItem>
            </MenuGroup>
          </>
        )}
      </MenuList>
    </Menu>
  );
};
