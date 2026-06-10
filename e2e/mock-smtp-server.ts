import { createServer as createTcpServer, type Socket } from "net";
import { createServer as createHttpServer } from "http";
import { MOCK_SMTP_SERVER_PORT, MOCK_SMTP_HTTP_PORT } from "./helpers/constants";
import { teeConsoleToFile } from "./helpers/log-to-file";

teeConsoleToFile("mock-smtp");

// A dependency-free mock mailer for e2e. It speaks just enough SMTP to accept a
// message from nodemailer over a plain (non-TLS) connection, captures the body,
// extracts the most recent 6-digit verification code per recipient, and exposes
// it over HTTP so a Playwright test can read the code it would have received by
// email. NOT a real mail server — no TLS, no auth enforcement, no delivery.

interface CapturedMail {
  to: string;
  code: string | null;
  // The first /invites/<id> link found in the body (the workspace-invitation
  // notification email); null for other mails (e.g. the verification code mail).
  inviteLink: string | null;
  subject: string | null;
  // All decoded candidate renderings of the body joined together, so tests can
  // substring-match content regardless of transfer encoding.
  body: string;
  receivedAt: number;
}

// Latest captured mail per (lowercased) recipient address.
const mailboxes = new Map<string, CapturedMail>();

function extractRecipient(rcptLine: string): string | null {
  // RCPT TO:<addr> (case-insensitive, optional angle brackets / params)
  const match = /RCPT TO:\s*<?([^>\s]+)>?/i.exec(rcptLine);
  return match ? match[1].toLowerCase() : null;
}

// Nodemailer transfer-encodes the body (quoted-printable, sometimes base64), and
// quoted-printable soft-wraps long lines with "=\r\n" — which can fall in the
// middle of the 6-digit code. Decode both so the code is contiguous before
// extracting. The verification email renders the code as the only 6-digit run.
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    );
}

// Drop the SMTP/MIME headers (everything up to the first blank line) so a
// 6-digit run in a header — notably the recipient address, which in tests may
// contain digits — is never mistaken for the code. Only the message body is
// scanned.
function stripHeaders(raw: string): string {
  const blank = raw.search(/\r?\n\r?\n/);
  return blank === -1 ? raw : raw.slice(blank);
}

function decodeBodyCandidates(raw: string): string[] {
  const body = stripHeaders(raw);
  const candidates = [body, decodeQuotedPrintable(body)];

  // A base64 body is long runs of base64 chars; try decoding the longest such run.
  const b64 = body.match(/[A-Za-z0-9+/=\r\n]{40,}/g);
  if (b64) {
    for (const chunk of b64) {
      try {
        candidates.push(Buffer.from(chunk.replace(/\s+/g, ""), "base64").toString("utf8"));
      } catch {
        // not base64 — ignore
      }
    }
  }

  return candidates;
}

function extractCode(body: string): string | null {
  for (const candidate of decodeBodyCandidates(body)) {
    const match = /(?<!\d)(\d{6})(?!\d)/.exec(candidate);
    if (match) return match[1];
  }
  return null;
}

function extractInviteLink(body: string): string | null {
  for (const candidate of decodeBodyCandidates(body)) {
    // The invitation email renders an <a href="…/invites/<id>"> button.
    const match = /https?:\/\/[^\s"'<>]*\/invites\/[A-Za-z0-9]+/.exec(candidate);
    if (match) return match[0];
  }
  return null;
}

// MIME-decode a Subject header. Handles the common nodemailer encodings: plain
// ASCII, RFC 2047 B (base64) and Q (quoted-printable-ish) encoded words.
function decodeSubjectValue(value: string): string {
  return value.replace(
    /=\?[^?]+\?([BQbq])\?([^?]*)\?=/g,
    (_m, enc: string, text: string) => {
      if (enc.toUpperCase() === "B") {
        try {
          return Buffer.from(text, "base64").toString("utf8");
        } catch {
          return text;
        }
      }
      return text
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m2, hex) =>
          String.fromCharCode(parseInt(hex, 16)),
        );
    },
  );
}

function extractSubject(raw: string): string | null {
  const headers = raw.slice(0, raw.search(/\r?\n\r?\n/) + 1 || raw.length);
  // Unfold header continuation lines before matching. Folding can leave double
  // spaces at the fold points; collapse them so tests see the logical subject.
  const unfolded = headers.replace(/\r?\n[ \t]+/g, " ");
  const match = /^Subject:[ \t]*(.+)$/im.exec(unfolded);
  return match
    ? decodeSubjectValue(match[1].trim()).replace(/\s+/g, " ")
    : null;
}

const smtpServer = createTcpServer((socket: Socket) => {
  socket.setEncoding("utf8");

  let buffer = "";
  let inData = false;
  let dataBuffer = "";
  const recipients: string[] = [];

  const send = (line: string) => socket.write(`${line}\r\n`);

  send("220 mock-smtp ready");

  socket.on("data", (chunk: string) => {
    buffer += chunk;

    // DATA mode: accumulate until the lone-dot terminator.
    if (inData) {
      dataBuffer += chunk;
      const terminator = dataBuffer.indexOf("\r\n.\r\n");
      if (terminator !== -1) {
        const message = dataBuffer.slice(0, terminator);
        const inviteLink = extractInviteLink(message);
        // The invitation email and the verification-code email are distinct
        // mails. Never read a "code" out of an invitation email — its body
        // carries a 6-digit-tailed invite ObjectId in the link that would
        // otherwise be mistaken for a verification code.
        const code = inviteLink ? null : extractCode(message);
        const subject = extractSubject(message);
        const body = decodeBodyCandidates(message).join("\n");
        // eslint-disable-next-line no-console
        console.log(
          `[mock-smtp] captured for ${recipients.join(",")}: subject=${subject ?? "NONE"} code=${code ?? "NONE"} link=${inviteLink ?? "NONE"} (raw ${message.length} bytes)`,
        );
        for (const to of recipients) {
          mailboxes.set(to, { to, code, inviteLink, subject, body, receivedAt: Date.now() });
        }
        inData = false;
        dataBuffer = "";
        buffer = "";
        send("250 OK: queued");
      }
      return;
    }

    let newlineIndex = buffer.indexOf("\r\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 2);
      const verb = line.slice(0, 4).toUpperCase();

      if (verb === "EHLO" || verb === "HELO") {
        send("250 mock-smtp");
      } else if (verb === "MAIL") {
        send("250 OK");
      } else if (verb === "RCPT") {
        const addr = extractRecipient(line);
        if (addr) recipients.push(addr);
        send("250 OK");
      } else if (verb === "DATA") {
        inData = true;
        send("354 End data with <CR><LF>.<CR><LF>");
        // Anything already buffered after DATA is message content.
        if (buffer.length) {
          socket.emit("data", buffer);
          buffer = "";
        }
        return;
      } else if (verb === "QUIT") {
        send("221 Bye");
        socket.end();
        return;
      } else if (verb === "RSET") {
        recipients.length = 0;
        send("250 OK");
      } else if (verb === "AUTH") {
        // Accept any credentials — the mock does not enforce auth.
        send("235 Authentication successful");
      } else {
        send("250 OK");
      }

      newlineIndex = buffer.indexOf("\r\n");
    }
  });

  socket.on("error", () => {
    // Ignore — nodemailer may drop the connection abruptly after QUIT.
  });
});

smtpServer.listen(MOCK_SMTP_SERVER_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-smtp] SMTP listening on ${MOCK_SMTP_SERVER_PORT}`);
});

// HTTP control surface: GET /code?to=<email> returns the latest captured code.
// Also serves as Playwright's readiness probe (it can't health-check raw SMTP).
const httpServer = createHttpServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${MOCK_SMTP_HTTP_PORT}`);

  if (url.pathname === "/code") {
    const to = (url.searchParams.get("to") || "").toLowerCase();
    const captured = mailboxes.get(to);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ code: captured?.code ?? null }));
    return;
  }

  if (url.pathname === "/invite-link") {
    const to = (url.searchParams.get("to") || "").toLowerCase();
    const captured = mailboxes.get(to);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ inviteLink: captured?.inviteLink ?? null }));
    return;
  }

  if (url.pathname === "/message") {
    const to = (url.searchParams.get("to") || "").toLowerCase();
    const captured = mailboxes.get(to);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify(
        captured
          ? { subject: captured.subject, body: captured.body, receivedAt: captured.receivedAt }
          : { subject: null, body: null, receivedAt: null },
      ),
    );
    return;
  }

  if (url.pathname === "/reset") {
    mailboxes.clear();
    res.writeHead(204);
    res.end();
    return;
  }

  // Root: readiness probe.
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok" }));
});

httpServer.listen(MOCK_SMTP_HTTP_PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[mock-smtp] HTTP control on ${MOCK_SMTP_HTTP_PORT}`);
});
