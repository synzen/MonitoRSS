export default `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h1 style="font-size: 20px;">You've been invited to a workspace</h1>
    <p>You've been invited to join the <strong>{{workspaceName}}</strong> workspace on MonitoRSS.</p>
    <p>Sign in and verify this email address to accept the invitation:</p>
    <p style="margin: 24px 0;">
      <a href="{{inviteUrl}}" style="background: #5865f2; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">View invitation</a>
    </p>
    <p style="color: #6b6b6b; font-size: 13px;">If you weren't expecting this, you can safely ignore this email.</p>
  </body>
</html>
`;
