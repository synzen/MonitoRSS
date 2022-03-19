/* eslint-disable react/jsx-no-useless-fragment */
import moment from 'moment-timezone';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import getChakraColor from '@/utils/getChakraColor';

interface Props {
  dateFormat?: string;
  timezone?: string;
}

export const LiveClock: React.FC<Props> = ({
  dateFormat,
  timezone,
}) => {
  const { t } = useTranslation();

  const getCurrentTime = () => {
    if (!timezone || !dateFormat) {
      return '';
    }

    if (!moment.tz.zone(timezone)) {
      return '';
    }

    return moment()
      .tz(timezone).format(dateFormat);
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
    <span style={{
      color: getChakraColor('red.500'),
    }}
    >
      {t('features.discordServers.components.liveClock.invalidSettings')}
    </span>
  );
};
