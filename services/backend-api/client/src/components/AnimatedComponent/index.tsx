import React from "react";
import { AnimatePresence, AnimatePresenceProps } from "framer-motion";

interface NewAnimatePresenceProps extends Omit<AnimatePresenceProps, "children"> {
  children: React.ReactNode;
}

export const AnimatedComponent = ({ children }: { children: React.ReactNode }) => {
  const NewAnimatePresence: React.FC<NewAnimatePresenceProps> = AnimatePresence;

  return <NewAnimatePresence>{children}</NewAnimatePresence>;
};
