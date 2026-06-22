import { Stack, StackProps, VisuallyHidden } from "@chakra-ui/react";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";
import { DismissableAlert } from "../components/DismissableAlert";
import { notifyError } from "../utils/notifyError";
import { notifySuccess } from "../utils/notifySuccess";
import { notifyInfo } from "../utils/notifyInfo";

interface AlertProps {
  title?: ReactNode;
  description?: ReactNode;
}

interface CreateAlertData {
  title?: ReactNode;
  description?: ReactNode;
}

interface AlertState extends CreateAlertData {
  id: string;
  status: "error" | "success" | "info";
}

type ContextProps = {
  createErrorAlert: (d: AlertProps) => void;
  createSuccessAlert: (d: AlertProps) => void;
  createInfoAlert: (d: AlertProps) => void;
  removeAlert: (id: string) => void;
  alerts: AlertState[];
};

export const PageAlertContext = createContext<ContextProps>({
  alerts: [],
  createErrorAlert: ({ title, description }) => {
    if (typeof title === "string" && typeof description === "string") {
      notifyError(title, description);
    }
  },
  createSuccessAlert: ({ title, description }) => {
    if (typeof title === "string" && typeof description === "string") {
      notifySuccess(title, description);
    }
  },
  createInfoAlert: ({ title, description }) => {
    if (typeof title === "string" && typeof description === "string") {
      notifyInfo(title, description);
    }
  },
  removeAlert: () => {},
});

export const PageAlertProvider = ({ children }: { children: ReactNode }) => {
  const [alerts, setAlerts] = useState<AlertState[]>([]);

  const createErrorAlert: ContextProps["createErrorAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { id: uuidv4(), ...data, status: "error" }]);
  }, []);

  const createSuccessAlert: ContextProps["createSuccessAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { id: uuidv4(), ...data, status: "success" }]);
  }, []);

  const createInfoAlert: ContextProps["createInfoAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { id: uuidv4(), ...data, status: "info" }]);
  }, []);

  const removeAlert: ContextProps["removeAlert"] = useCallback((id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const contextValue = useMemo(() => {
    return {
      createErrorAlert,
      createSuccessAlert,
      createInfoAlert,
      alerts,
      removeAlert,
    };
  }, [createErrorAlert, createSuccessAlert, createInfoAlert, removeAlert, alerts]);

  return (
    <PageAlertContext.Provider value={contextValue}>
      <PageAlertLiveRegion alerts={alerts} />
      {children}
    </PageAlertContext.Provider>
  );
};

// Best-effort plain text from an alert's title/description for the live region.
// Most alerts pass strings; anything non-string is skipped (it still shows in the
// visible alert, just isn't spoken through this region).
const alertText = (alert: AlertState) =>
  [alert.title, alert.description].filter((v) => typeof v === "string").join(". ");

// One permanently-mounted, zero-footprint polite live region per provider speaks
// the most recently raised alert. It lives here (not in the visible outlet) so it
// is always in the accessibility tree: a screen reader only reliably announces a
// region that already exists when its text changes, whereas a region inserted
// together with its content, or toggled from display:none, is missed by NVDA/JAWS.
// The visible PageAlertContextOutlet stays purely visual and renders nothing when
// empty, so it adds no whitespace.
const PageAlertLiveRegion = ({ alerts }: { alerts: AlertState[] }) => {
  const [announcement, setAnnouncement] = useState("");
  const latest = alerts[alerts.length - 1];
  // Keyed on the alert id (via latestText carrying the id) so only a newly raised
  // alert re-announces, not a re-render or an unrelated dismissal.
  const latestId = latest?.id;
  const latestText = latest ? alertText(latest) : "";
  useEffect(() => {
    if (!latestId) {
      return undefined;
    }

    // Clear first so re-raising an identical message still re-announces: a live
    // region only speaks when its text content actually changes.
    setAnnouncement("");
    const timer = window.setTimeout(() => setAnnouncement(latestText), 50);

    return () => window.clearTimeout(timer);
  }, [latestId, latestText]);

  return <VisuallyHidden role="status">{announcement}</VisuallyHidden>;
};

export const usePageAlertContext = () => {
  const contextData = useContext(PageAlertContext);

  return contextData;
};

interface PageAlertContextOutletProps {
  containerProps?: StackProps;
}

// The visible alert stack. Purely visual: announcements are handled once by the
// provider's PageAlertLiveRegion. Renders nothing when there are no alerts, so
// the outlet takes no layout room and adds no surrounding whitespace.
export const PageAlertContextOutlet = ({ containerProps }: PageAlertContextOutletProps) => {
  const { alerts, removeAlert } = usePageAlertContext();

  const onRemoved = useCallback(
    (id: string) => {
      removeAlert(id);
    },
    [removeAlert],
  );

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Stack
      gap={2}
      position="sticky"
      top={0}
      zIndex={containerProps?.zIndex ?? 1}
      w="100%"
      {...containerProps}
    >
      {alerts.map((alert) => {
        return (
          <DismissableAlert
            key={alert.id}
            status={alert.status}
            description={alert.description}
            title={alert.title}
            onClosed={() => {
              onRemoved(alert.id);
            }}
          />
        );
      })}
    </Stack>
  );
};
