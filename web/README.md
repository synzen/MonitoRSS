A web server for https://github.com/synzen/Discord.RSS to manage your feeds. The backend is built with Express with server-side sessions, websockets, and a RESTful API. The front end is built with create-react-app (in ./client folder), with Redux and React Router. User authentication is done via Discord's OAuth2.

# Preview

Mobile responsive UI, built according to Discord's theme with Discord's blessing

![UI Screenshot](https://i.imgur.com/lHnZOJi.png)

# Development:

### Backend

1. `npm install` in this directory to install backend requisites
2. Set up variables under web configuration in config.json
   - `config.web.clientId` (Bot Client ID)
   - `config.web.clientSecret` (Bot Client Secret)
   - `config.web.sessionSecret` (Set to some random string)
   - `config.web.redirectUri` (Discord OAuth2 Redirect URI - set to http://domain.xyz/authorize - replace domain what whatever yours is)
3. Run `npm run dev` either in this directory, or run it with the bot by running `npm run dev-client` in the bot's main directory.

### Frontend

1. `npm install` in ./client to install frontend requisites
2. `npm start` in ./client
3. Make sure the proxy's URL port for create-react-app in ./client/package.json is set to `config.web.port`
4. Authenticate yourself (since the backend API authentication is done through Discord's OAuth2, you must do the following steps below to test the already-built backend API to first authorize yourself):
    - Make sure the backend is running
    - Go to http://localhost:PORT/login with the PORT replaced with whatever you set in `config.web.port`
    - Authorize application to Discord
8. Enter `http://localhost:3000` to run the dev server (The port in `config.web.port` only uses files built with `npm run build`)

## API Tests

Run `npm test`