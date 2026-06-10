import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { chakra } from "@chakra-ui/react";
import { pages } from "../../constants";

export const AccessibleNavigationAnnouncer = () => {
  // the message that will be announced
  const [message, setMessage] = useState("");
  // get location from router
  const location = useLocation();
  const locationPathname = location.pathname;

  // only run this when location change (note the dependency [location])
  useEffect(() => {
    // ignore the /
    if (locationPathname.slice(1)) {
      // make sure navigation has occurred and screen reader is ready
      setTimeout(() => {
        /**
         * check if current focus is on an input field. If so, don't announce navigation.
         * specifically for non-screen-reader users who immediately focus on an input after navigation
         */
        const activeElement = document.activeElement as HTMLElement;

        if (activeElement && ["INPUT", "TEXTAREA"].includes(activeElement.tagName)) {
          return;
        }

        /**
         * If the user has already opened a popup (e.g. the header workspace switcher menu)
         * by the time this delayed callback runs, stealing focus to the h1 would dismiss
         * the popup out from under them.
         */
        if (
          activeElement &&
          (activeElement.closest('[role="menu"], [role="dialog"], [role="listbox"]') ||
            activeElement.getAttribute("aria-expanded") === "true")
        ) {
          return;
        }

        const checkoutRootPath = pages.checkout(":id").split("/")[1];

        if (locationPathname.includes(checkoutRootPath)) {
          setMessage(`Navigated to checkout page.`);
        } else {
          setMessage(`Navigated to ${locationPathname.slice(1)} page.`);
        }

        const h1Element = document.querySelector("h1");

        if (h1Element) {
          h1Element.focus();
        }
      }, 500);
    } else {
      // just ignore the / route
      setMessage("");
    }
  }, [locationPathname]);

  return (
    <chakra.span srOnly role="status" aria-live="polite" aria-atomic="true">
      {message}
    </chakra.span>
  );
};
