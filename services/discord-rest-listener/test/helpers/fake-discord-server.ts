import http from "http"
import { AddressInfo } from "net"

export interface FakeDiscordResponse {
  status: number
  headers?: Record<string, string>
  body?: unknown
  hang?: boolean
}

export type ResponseProvider = (
  context: { callCount: number }
) => FakeDiscordResponse

export interface CapturedRequest {
  method: string
  pathname: string
  rawUrl: string
  headers: Record<string, string | string[] | undefined>
  body: string
}

export interface FakeDiscordServer {
  baseUrl: string
  /**
   * Register a response provider for an exact pathname (e.g. "/api/v10/channels/123/messages").
   * The provider receives the call count so it can vary responses across retries.
   */
  register(pathname: string, provider: ResponseProvider): void
  /** Replace the default fallback used when no pathname matches. */
  setDefault(provider: ResponseProvider): void
  /** All requests received since the last clear. */
  getRequests(): CapturedRequest[]
  /** Requests for a specific pathname. */
  getRequestsFor(pathname: string): CapturedRequest[]
  /** Wipe captured state and response registry (keeps the server running). */
  clear(): void
  stop(): Promise<void>
}

const defaultFallback: ResponseProvider = () => ({
  status: 500,
  body: { error: "no response registered for this path" },
})

export async function startFakeDiscordServer(): Promise<FakeDiscordServer> {
  const registry = new Map<string, ResponseProvider>()
  const callCounts = new Map<string, number>()
  const requests: CapturedRequest[] = []
  let fallback: ResponseProvider = defaultFallback

  const server = http.createServer((req, res) => {
    let raw = ""
    req.on("data", (chunk) => {
      raw += chunk.toString()
    })
    req.on("end", () => {
      const url = new URL(req.url ?? "/", "http://localhost")
      const captured: CapturedRequest = {
        method: req.method ?? "GET",
        pathname: url.pathname,
        rawUrl: req.url ?? "/",
        headers: req.headers,
        body: raw,
      }
      requests.push(captured)

      const provider = registry.get(url.pathname) ?? fallback
      const callCount = (callCounts.get(url.pathname) ?? 0) + 1
      callCounts.set(url.pathname, callCount)

      let response: FakeDiscordResponse
      try {
        response = provider({ callCount })
      } catch (err) {
        response = {
          status: 500,
          body: { error: (err as Error).message },
        }
      }

      if (response.hang) {
        return
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(response.headers ?? {}),
      }

      const bodyText =
        response.body === undefined || response.body === null
          ? ""
          : typeof response.body === "string"
            ? response.body
            : JSON.stringify(response.body)

      res.writeHead(response.status, headers)
      res.end(bodyText)
    })
  })

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const port = (server.address() as AddressInfo).port
  const baseUrl = `http://127.0.0.1:${port}`

  return {
    baseUrl,
    register(pathname, provider) {
      registry.set(pathname, provider)
    },
    setDefault(provider) {
      fallback = provider
    },
    getRequests() {
      return [...requests]
    },
    getRequestsFor(pathname) {
      return requests.filter((r) => r.pathname === pathname)
    },
    clear() {
      registry.clear()
      callCounts.clear()
      requests.length = 0
      fallback = defaultFallback
    },
    async stop() {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve()))
      )
    },
  }
}
