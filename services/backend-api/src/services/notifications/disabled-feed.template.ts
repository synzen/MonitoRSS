const DISABLED_FEED_TEMPLATE = `<html
lang="en"
xmlns="http://www.w3.org/1999/xhtml"
xmlns:v="urn:schemas-microsoft-com:vml"
xmlns:o="urn:schemas-microsoft-com:office:office"
>
<head>
  <!--[if !mso]><!-- -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <!--<![endif]-->
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="background: #CBD5E0; color: #171923; font-size: 16px;">
  <table
    border="0"
    cellspacing="0"
    cellpadding="0"
    role="presentation"
    style=" border-radius: 4px; padding: 24px;"
    width="100%"
  >
    <tr>
      <td align="center">
        <table
          border="0"
          cellspacing="0"
          cellpadding="0"
          role="presentation"
          width="600"
          style="border-radius: 8px;  padding-bottom: 24px; table-layout: fixed;"
        >
          <tr>
            <td
              align="left"
              style="padding-top: 24px; padding-left: 0px; padding-right: 24px; font-size: 18px; font-weight: 600"
            >
              MonitoRSS
            </td>
          </tr>
        </table>
        <table
          border="0"
          cellspacing="0"
          cellpadding="0"
          role="presentation"
          width="600"
          style="background: #EDF2F7; border-radius: 8px; table-layout: fixed;"
        >
          <tr>
            <td
              style="background: red; padding-bottom: 4px; border-top-left-radius: 4px; border-top-right-radius: 4px;"
            ></td>
          </tr>
          <tr>
            <td
              style="padding-top: 24px; padding-left: 24px; padding-right: 24px; font-size: 24px; font-weight: 600"
            >
              {{#if connectionName}}
                Your connection "{{connectionName}}" assigned to your feed "{{feedName}}"
                has been disabled
              {{else}}
                Your feed,
                {{feedName}}, has been disabled
              {{/if}}
            </td>
          </tr>
          <tr>
            <td
              style="padding-top: 24px; padding-left: 24px; padding-right: 24px;"
            >
              {{#if connectionName}}
                There was an issue while processing your feed that forced the
                connection to be disabled. Articles will no longer be
                delivered for this connection until it is re-enabled. See
                below for details.
              {{else}}
                There was an issue while processing your feed that forced it
                to be disabled. Articles will no longer be delivered for this
                feed until it is re-enabled. See below for details.
              {{/if}}
            </td>
          </tr>
          <tr>
            <td
              style="padding-top: 32px; padding-left: 24px; padding-right: 24px;"
            >
              <table
                border="0"
                cellspacing="0"
                role="presentation"
                cellpadding="0"
              >
                <tr>
                  <td style="color: #718096; font-weight: 600;">Feed Name</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px">
                    {{feedName}}
                  </td>
                </tr>
                <tr>
                  <td style="color: #718096; font-weight: 600;">Feed URL</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px">
                    <a
                      target="_blank"
                      href="{{feedUrlLink}}"
                      rel="noopener noreferrer"
                      style="color: #3182ce"
                    >
                      {{feedUrlDisplay}}
                    </a>
                  </td>
                </tr>
                {{#if articleId}}
                  <tr>
                    <td style="color: #718096; font-weight: 600;">Article ID</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 16px">
                      {{articleId}}
                    </td>
                  </tr>
                {{/if}}
                {{#if connectionName}}
                  <tr>
                    <td style="color: #718096; font-weight: 600;">Connection
                      Name</td>
                  </tr>
                  <tr>
                    <td style="padding-bottom: 16px">
                      {{connectionName}}
                    </td>
                  </tr>
                {{/if}}
                <tr>
                  <td style="color: #718096; font-weight: 600;">Reason</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px">
                    {{reason}}
                    {{#if rejectedMessage}}
                      <table
                        border="0"
                        cellspacing="0"
                        role="presentation"
                        cellpadding="0"
                      >
                        <tr>
                          <td style="font-family: monospace; padding-top: 8px;">
                            {{rejectedMessage}}
                          </td>
                        </tr>
                      </table>
                    {{/if}}
                  </td>
                </tr>
                <tr>
                  <td style="color: #718096; font-weight: 600;">Action
                    Required</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px">
                    {{#if actionRequired}}
                      {{actionRequired}}
                    {{else}}
                      N/A
                    {{/if}}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td
              style="padding-top: 32px; padding-left: 24px; padding-right: 24px; padding-bottom: 24px;"
            >
              <div
              ><!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="{{controlPanelUrl}}" style="height:50px;v-text-anchor:middle;width:240px;" arcsize="8%" stroke="f" fillcolor="#3182ce">
  <w:anchorlock/>
  <center>
<![endif]-->
                <a
                  href="{{controlPanelUrl}}"
                  target="_blank"
                  style="background-color:#3182ce;border-radius:4px;color:#ffffff;display:inline-block;font-family:sans-serif;font-size:16px;line-height:50px;text-align:center;text-decoration:none;width:240px;-webkit-text-size-adjust:none;"
                >
                  {{#if connectionName}}
                    Manage feed connection
                  {{else}}
                    Manage feed
                  {{/if}}
                </a>
                <!--[if mso]>
  </center>
</v:roundrect>
<![endif]--></div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td align="center">
        <table
          border="0"
          cellspacing="0"
          cellpadding="0"
          role="presentation"
          width="600"
          style="border-radius: 8px;  padding-bottom: 24px;"
        >
          <tr>
            <td
              align="left"
              style="font-size: 14px; padding-top: 24px; color: #2D3748;"
            >
              You are receiving this because you have opted in to receive
              notifications about feed-related failures. To manage your
              notifications,
              <a
                target="_blank"
                href="{{manageNotificationsUrl}}"
                style="color: #3182ce;"
              >click here</a>.
            </td>
          </tr>
        </table>
      </td>
    </tr>

  </table>
</body>
</html>`;

export default DISABLED_FEED_TEMPLATE;
