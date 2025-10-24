import { Stack, StackProps } from "@chakra-ui/react";
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
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

  return <PageAlertContext.Provider value={contextValue}>{children}</PageAlertContext.Provider>;
};

export const usePageAlertContext = () => {
  const contextData = useContext(PageAlertContext);

  return contextData;
};

interface PageAlertContextOutletProps {
  containerProps?: StackProps;
}

export const PageAlertContextOutlet = ({ containerProps }: PageAlertContextOutletProps) => {
  const { alerts, removeAlert } = usePageAlertContext();

  const onRemoved = useCallback(
    (id: string) => {
      removeAlert(id);
    },
    [removeAlert]
  );

  return (
    <Stack
      hidden={alerts.length === 0}
      spacing={2}
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
