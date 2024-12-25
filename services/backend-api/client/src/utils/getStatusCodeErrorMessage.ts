const messages = {
  BAD_REQUEST:
    "An unexpected issue occurred. If the error persists, please contact support@monitorss.xyz.",
  UNAUTHORIZED:
    "Unauthorized. Refresh the page, or log out and log in again. If the error persists, contact support@monitorss.xyz.",
  FORBIDDEN:
    "Access forbidden. Refresh the page, or log out and log in again. If the error persists, contact support@monitorss.xyz.",
  INTERNAL_SERVER_ERROR:
    "An unexpected issue occurred. Try refreshing the page. If the error persists, please contact support@monitorss.xyz.",
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

  return `An unexpected issue occurred (status ${statusCode}). You may try refreshing the page. If the error persists, please contact support@monitorss.xyz.`;
};

export default getStatusCodeErrorMessage;
