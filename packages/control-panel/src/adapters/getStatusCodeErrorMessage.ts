const messages = {
  BAD_REQUEST: 'Bad Request',
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
} as const;

const UNEXPECTED_ERROR = 'Unexpected Error';

const getStatusCodeErrorMessage = (statusCode: number) => {
  const statusCodeStr = statusCode.toString();

  if (statusCodeStr.startsWith('5')) { return messages.INTERNAL_SERVER_ERROR; }

  if (statusCode === 401) { return messages.UNAUTHORIZED; }

  if (statusCode === 403) { return messages.FORBIDDEN; }

  if (statusCodeStr.startsWith('4')) { return messages.BAD_REQUEST; }

  return UNEXPECTED_ERROR;
};

export default getStatusCodeErrorMessage;
