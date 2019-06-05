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
3. Start the bot normally (`node server`)

### Frontend

1. `npm install` in ./client to install frontend requisites
2. `npm start` in ./client
3. Make sure the proxy's URL port for create-react-app in ./client/package.json is set to `config.web.port`
4. Authenticate yourself (since the backend API authentication is done through Discord's OAuth2, you must do the following steps below to test the already-built backend API to first authorize yourself):
    - Make sure the backend is running
    - Go to http://localhost:PORT/login with the PORT replaced with whatever you set in `config.web.port`
    - Authorize application to Discord
5. Replace the port in the URL after the authorization redirects you with the port in `config.web.port`

Note that if you don't do step 5, the files being served are NOT from the webpack dev server - it's from the built files from `npm run build`. For live changes, make sure to do step 5.

## API Tests

Run `npm test`