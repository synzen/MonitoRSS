A web server for https://github.com/synzen/Discord.RSS to manage your feeds. The backend is built with Express with server-side sessions, websockets, and a RESTful API. The front end is built with create-react-app (in ./client folder), with Redux and React Router. User authentication is done via Discord's OAuth2.

## Steps for Development:

### Backend

1. `npm install` in this directory to install backend requisites
2. Set up environment variables in .env
   - `DRSS_EXPERIMENTAL_FEATURES=true` (must be set to true)
   - `DRSS_BOT_TOKEN`
   - `DRSS_DATABASE_URI`
   - `DRSS_CLIENT_ID` (Bot Client ID)
   - `DRSS_CLIENT_SECRET` (Bot Client Secret)
   - `DRSS_REDIRECT_URI` (Discord OAuth2 Redirect URI)
   - `DRSS_PORT` (Port for the webserver)
3. Run `npm run dev` either in this directory, or run it with the bot by running `npm run dev-client` in the bot's main directory.

### Frontend

1. `npm install` in ./client to install frontend requisites
2. `npm run start` in ./client




## API Requests on Frontend

Working on the front end is easy, but since the backend API authentication is done through Discord's OAuth2, you must do the following steps below to test the already-built backend API to first authorize yourself.

1. Make sure the backend is running
2. Go to http://localhost:PORT/login with the port replaced with whatever you set in `process.env.DRSS_PORT`
3. Authenticate yourself through Discord
4. Make sure the proxy's URL port for create-react-app in ./client/package.json is set to `process.env.DRSS_PORT`

You're now able to make API requests on the frontend to the backend. (webpack's (create-react-app) dev server, proxied through to the backend). By authenticating yourself through Discord, the server has now stored your session and recognizes you.