export default `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h1 style="font-size: 20px;">Reddit connection lost for {{workspaceName}}</h1>
    <p>The Reddit account connected to the <strong>{{workspaceName}}</strong> workspace on MonitoRSS is no longer active.</p>
    <p>Reddit feeds in this workspace will stop updating until a member reconnects a Reddit account.</p>
    <p style="margin: 24px 0;">
      <a href="{{settingsUrl}}" style="background: #5865f2; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Reconnect Reddit</a>
    </p>
    <p style="color: #6b6b6b; font-size: 13px;">Any member of the workspace can reconnect using their own Reddit account.</p>
  </body>
</html>
`;
