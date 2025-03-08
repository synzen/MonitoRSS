import { Stack, StackProps } from "@chakra-ui/react";
import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from "react";
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
  status: "error" | "success" | "info";
}

type ContextProps = {
  createErrorAlert: (d: AlertProps) => void;
  createSuccessAlert: (d: AlertProps) => void;
  createInfoAlert: (d: AlertProps) => void;
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
});

export const PageAlertProvider = ({ children }: { children: ReactNode }) => {
  const [alerts, setAlerts] = useState<AlertState[]>([]);

  const createErrorAlert: ContextProps["createErrorAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { ...data, status: "error" }]);
  }, []);

  const createSuccessAlert: ContextProps["createSuccessAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { ...data, status: "success" }]);
  }, []);

  const createInfoAlert: ContextProps["createInfoAlert"] = useCallback((data) => {
    setAlerts((prev) => [...prev, { ...data, status: "info" }]);
  }, []);

  const contextValue = useMemo(() => {
    return {
      createErrorAlert,
      createSuccessAlert,
      createInfoAlert,
      alerts,
    };
  }, [createErrorAlert, createSuccessAlert, createInfoAlert, alerts]);

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
  const { alerts } = usePageAlertContext();
  const [closedCount, setClosedCount] = useState(0);

  return (
    <Stack
      hidden={closedCount === alerts.length}
      spacing={2}
      position="sticky"
      top={0}
      zIndex={1}
      w="100%"
      {...containerProps}
    >
      {alerts.map((alert, index) => {
        return (
          <DismissableAlert
            key={alert.title + index.toString()}
            status={alert.status}
            description={alert.description}
            title={alert.title}
            onClosed={() => {
              setClosedCount((prev) => prev + 1);
            }}
          />
        );
      })}
    </Stack>
  );
};
