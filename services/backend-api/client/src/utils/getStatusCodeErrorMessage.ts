const messages = {
  BAD_REQUEST: "Bad Request",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Forbidden",
  INTERNAL_SERVER_ERROR: "Internal Server Error",
} as const;

const getStatusCodeErrorMessage = (statusCode: number) => {
  const statusCodeStr = statusCode.toString();

  if (statusCodeStr.startsWith("5")) {
    return messages.INTERNAL_SERVER_ERROR;
  }

  if (statusCode === 401) {
    return messages.UNAUTHORIZED;
  }

  if (statusCode === 403) {
    return messages.FORBIDDEN;
  }

  if (statusCode === 400) {
    return messages.BAD_REQUEST;
  }

  return `Internal error occurred. You may try refreshing the page. If the error persists, please contact support@monitorss.xyz (status code: ${statusCode})`;
};

export default getStatusCodeErrorMessage;
