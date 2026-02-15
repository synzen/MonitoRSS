export const useLogin = () => {
  const redirectToLogin = (data?: { addScopes?: string }) => {
    const currentPath = window.location.pathname;
    const jsonState = JSON.stringify({
      path: currentPath,
    });

    const addScopesQuery = data?.addScopes
      ? `&addScopes=${encodeURIComponent(data.addScopes)}`
      : "";

    window.location.href = `/api/v1/discord/login-v2?jsonState=${encodeURIComponent(
      jsonState,
    )}${addScopesQuery}`;
  };

  return {
    redirectToLogin,
  };
};
