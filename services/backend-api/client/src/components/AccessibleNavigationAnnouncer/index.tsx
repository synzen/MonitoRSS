import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { chakra } from "@chakra-ui/react";
import { pages } from "../../constants";

export const AccessibleNavigationAnnouncer = () => {
  // the message that will be announced
  const [message, setMessage] = useState("");
  // get location from router
  const location = useLocation();

  // only run this when location change (note the dependency [location])
  useEffect(() => {
    // ignore the /
    if (location.pathname.slice(1)) {
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

        const checkoutRootPath = pages.checkout(":id").split("/")[1];

        if (location.pathname.includes(checkoutRootPath)) {
          setMessage(`Navigated to checkout page.`);
        } else {
          setMessage(`Navigated to ${location.pathname.slice(1)} page.`);
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
  }, [location]);

  return (
    <chakra.span srOnly role="status" aria-live="polite" aria-atomic="true">
      {message}
    </chakra.span>
  );
};
