const WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE = `<html
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
              {{feedCount}} {{#if multipleFeeds}}feeds{{else}}feed{{/if}} in your
              workspace "{{workspaceName}}" {{#if multipleFeeds}}have{{else}}has{{/if}}
              been disabled
            </td>
          </tr>
          <tr>
            <td
              style="padding-top: 24px; padding-left: 24px; padding-right: 24px;"
            >
              The workspace exceeded its feed limit, so the oldest feeds over the
              limit were disabled. Articles will no longer be delivered for these
              feeds until the workspace is back under its limit.
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
                  <td style="color: #718096; font-weight: 600; padding-bottom: 8px;">Disabled Feeds</td>
                </tr>
                {{#each feeds}}
                  <tr>
                    <td style="padding-bottom: 8px">
                      {{this.name}}
                      (<a
                        target="_blank"
                        href="{{this.urlLink}}"
                        rel="noopener noreferrer"
                        style="color: #3182ce"
                      >{{this.urlDisplay}}</a>)
                    </td>
                  </tr>
                {{/each}}
                <tr>
                  <td style="color: #718096; font-weight: 600; padding-top: 8px;">Action
                    Required</td>
                </tr>
                <tr>
                  <td style="padding-bottom: 16px">
                    Remove or disable other feeds to bring the workspace under its
                    feed limit, after which disabled feeds will be re-enabled
                    automatically.
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
                  Manage workspace feeds
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

export default WORKSPACE_FEEDS_DISABLED_DIGEST_TEMPLATE;
