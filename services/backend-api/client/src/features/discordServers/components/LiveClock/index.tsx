/* eslint-disable react/jsx-no-useless-fragment */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import dayjs from "dayjs";

interface Props {
  dateFormat?: string;
  timezone?: string;
}

export const LiveClock: React.FC<Props> = ({ dateFormat, timezone }) => {
  const { t } = useTranslation();

  const getCurrentTime = () => {
    if (!timezone || !dateFormat) {
      return "";
    }

    if (!Intl.supportedValuesOf("timeZone").includes(timezone)) {
      return "";
    }

    return dayjs().tz(timezone).format(dateFormat);
  };

  const [timeNow, setTimeNow] = useState(getCurrentTime());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeNow(getCurrentTime());
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  });

  useEffect(() => {
    setTimeNow(getCurrentTime());
  }, [dateFormat, timezone]);

  if (timeNow) {
    return <>{timeNow}</>;
  }

  return (
    <span
      style={{
        color: "var(--app-text-error)",
      }}
    >
      {t("features.discordServers.components.liveClock.invalidSettings")}
    </span>
  );
};
