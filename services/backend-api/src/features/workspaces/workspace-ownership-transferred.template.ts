export default `
<!DOCTYPE html>
<html lang="en">
  <body style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.5;">
    <h1 style="font-size: 20px;">You are now the owner of {{workspaceName}}</h1>
    <p>Ownership of the <strong>{{workspaceName}}</strong> workspace on MonitoRSS has been transferred to you. You now have full control of the workspace, including its members and billing.</p>
    {{#if hasSubscription}}
    <p>This workspace has an active subscription that is still billed to the previous owner's payment method. To pay with your own card, update the payment method from the workspace billing settings.</p>
    {{/if}}
    <p style="margin: 24px 0;">
      <a href="{{settingsUrl}}" style="background: #5865f2; color: #ffffff; padding: 12px 20px; border-radius: 6px; text-decoration: none; font-weight: bold;">Open workspace settings</a>
    </p>
  </body>
</html>
`;
