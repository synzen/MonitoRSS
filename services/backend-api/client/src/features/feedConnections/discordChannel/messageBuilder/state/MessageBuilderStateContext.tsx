import React, { createContext, useContext, useReducer, useRef, useMemo, ReactNode } from "react";
import { MessageComponentRoot } from "../types";
import { MessageBuilderAction, MessageBuilderReducerState } from "./messageBuilderActions";
import { messageBuilderReducer } from "./messageBuilderReducer";
import { useMessageBuilderValidation } from "./useMessageBuilderValidation";
import { useMessageBuilderDirty } from "./useMessageBuilderDirty";

interface MessageBuilderStateContextType {
  messageComponent: MessageComponentRoot | undefined;
  messageComponentRef: React.RefObject<MessageComponentRoot | undefined>;
  serverMessageComponent: MessageComponentRoot | undefined;
  dispatch: React.Dispatch<MessageBuilderAction>;
  errors: Record<string, any>;
  isDirty: boolean;
  validate: () => Promise<boolean>;
}

const MessageBuilderStateContext = createContext<MessageBuilderStateContextType | undefined>(
  undefined,
);

export function useMessageBuilderStateContext() {
  const context = useContext(MessageBuilderStateContext);

  if (!context) {
    throw new Error(
      "useMessageBuilderStateContext must be used within a MessageBuilderStateProvider",
    );
  }

  return context;
}

export const MessageBuilderStateProvider: React.FC<{
  initialMessageComponent?: MessageComponentRoot;
  serverMessageComponent?: MessageComponentRoot;
  children: ReactNode;
}> = ({ initialMessageComponent, serverMessageComponent, children }) => {
  const [state, dispatch] = useReducer(messageBuilderReducer, {
    messageComponent: initialMessageComponent,
  } as MessageBuilderReducerState);

  const messageComponentRef = useRef(state.messageComponent);
  messageComponentRef.current = state.messageComponent;

  const { errors, validate } = useMessageBuilderValidation(state.messageComponent);
  const { isDirty } = useMessageBuilderDirty(state.messageComponent, serverMessageComponent);

  const contextValue: MessageBuilderStateContextType = useMemo(
    () => ({
      messageComponent: state.messageComponent,
      messageComponentRef,
      serverMessageComponent,
      dispatch,
      errors,
      isDirty,
      validate,
    }),
    [
      state.messageComponent,
      messageComponentRef,
      serverMessageComponent,
      errors,
      isDirty,
      validate,
    ],
  );

  return (
    <MessageBuilderStateContext.Provider value={contextValue}>
      {children}
    </MessageBuilderStateContext.Provider>
  );
};
