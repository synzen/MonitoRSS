/* eslint-disable no-sequences */
/* eslint-disable func-names */
/* eslint-disable prefer-rest-params */
/* eslint-disable @typescript-eslint/no-unused-expressions */
import { useEffect } from "react";

const widgetId = import.meta.env.VITE_FRESHDESK_WIDGET_ID;

export const SupportWidget = () => {
  useEffect(() => {
    if (!widgetId) {
      return () => {};
    }

    // @ts-ignore
    window.fwSettings = {
      widget_id: widgetId,
    };

    // @ts-ignore
    !(function () {
      // @ts-ignore
      if (typeof window.FreshworksWidget !== "function") {
        const n = function () {
          n.q.push(arguments);
        };

        // @ts-ignore
        (n.q = []), (window.FreshworksWidget = n);
      }
    })();

    const widgetScript = document.createElement("script");

    widgetScript.src = `https://widget.freshworks.com/widgets/${widgetId}.js`;
    widgetScript.async = true;
    widgetScript.defer = true;
    document.body.appendChild(widgetScript);

    const observer = new MutationObserver((_, o) => {
      const freshdeskElement = document.getElementById("freshworks-container");

      if (freshdeskElement) {
        freshdeskElement.style.colorScheme = "normal";
        o.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return null;
};
