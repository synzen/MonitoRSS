# Control panel client

## Local development

Install dependencies, then start the client from this directory:

```bash
npm install
npm run dev
```

The development server runs at <http://localhost:3000> and proxies API requests to
<http://localhost:8000> by default.

### Preview with the mock API

To work on the interface without running the backend services:

```bash
npm run dev-mockapi
```

Open <http://localhost:3000>. The mock API supplies local fixture data and supports
the loading and error-state flags used by client features.

The `dev-mockapi` script already exposes the Vite server on the local network. Do not
append another `--host` argument; an extra positional argument can be interpreted as
the Vite project root.
