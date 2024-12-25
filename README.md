# MonitoRSS (formerly Discord.RSS)

Delivers highly-customized news feeds to Discord!

- [MonitoRSS (formerly Discord.RSS)](#monitorss-formerly-discordrss)
  - [Get Started](#get-started)
    - [Use Public Instance](#use-public-instance)
    - [Self Host](#self-host)
      - [Customize Site Domain](#customize-site-domain)
      - [Enable Email Notifications](#enable-email-notifications)
      - [Enable Reddit Authorizations](#enable-reddit-authorizations)
      - [Updating](#updating)
  - [Migrating from v6](#migrating-from-v6)


## Get Started

### Use Public Instance
To use the publicly hosted instance for free, visit https://monitorss.xyz!

### Self Host

Docker is required to easily coordinate and run multiple services at once.

> [!NOTE]  
>  General knowledge of how Docker, Docker volumes, and docker compose works is highly recommended to avoid accidental data loss

1. Install [Docker Engine](https://docs.docker.com/engine/install/)
2. Install [Docker Compose](https://docs.docker.com/compose/install/)
3. Clone this repo's `main` (the default) branch - `git clone https://github.com/synzen/MonitoRSS.git`
4. Create a Discord application through [Discord's developer portal](https://discord.com/developers/applications) if you do not already have one
5. Create a copy of the existing `.env.example` file and rename it to `.env.prod`
6. Replace all relevant values in the `.env.prod` file with your own values
   1. If you have your own MongoDB instance, set `BACKEND_API_MONGODB_URI` to your MongoDB URI
   2. Add your email at the end of `FEED_REQUESTS_FEED_REQUEST_DEFAULT_USER_AGENT` for feed hosts to be able to contact you if you violate their usage policies. For example, `MonitoRSS [Self-Hosted]/1.0 youremail@email.com`.
   3. Replace all instances of "BOT_TOKEN_HERE" with your Discord bot application token
   4. Replace all instances of "BOT_CLIENT_ID_HERE" with your Discord bot application ID
   5. Replace all instances of "BOT_CLIENT_SECRET_HERE" with your Discord bot application secret
   6. Set `BACKEND_API_SESSION_SECRET` to a random 64-character string
   7.  Set `BACKEND_API_SESSION_SALT` to a random 16-character string
   8.  Add `http://localhost:8000/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 page
7.  Run `docker compose up -d`
    -  If you run into issues with network timeouts, pass the parallel flag to only build 1 container at once: `docker compose --parallel 1 up -d`
    -  Any containers ending in `-migration` do not need to be running
8.  Access the control panel via http://localhost:8000

#### Customize Site Domain

1. Set up your domain to point to the server running the control panel on localhost
2. Update all references to `http://localhost:8000` in your `.env.prod` to your desired domain. For example, `https://mynewdomain.com`.
3. Add `{DOMAIN_HERE}/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 page, replacing `{DOMAIN_HERE}` with the value you set in step 1

#### Enable Email Notifications

While email notifications are available so that you may get notified when feeds are disabled for various reasons (permission erorrs, request errors, etc), credentials must be set to be able to send them out. Set the three variables below with your email provider's SMTP settings in your env file:

- `BACKEND_API_SMTP_HOST`
- `BACKEND_API_SMTP_USERNAME`
- `BACKEND_API_SMTP_PASSWORD`
- `BACKEND_API_SMTP_FROM`

Make sure to opt into email notifications in the control panel's user settings page afterwards.

#### Enable Reddit Authorizations

1. Create a Reddit application at https://www.reddit.com/prefs/apps as a "web app".
2. Add `{DOMAIN_HERE}/api/v1/reddit/callback` to the list of redirect URIs in your Reddit application settings, replacing `{DOMAIN_HERE}` with your domain that you're using to access the control panel.
3. Copy the redirect URI you just added and set it as `BACKEND_API_REDDIT_REDIRECT_URI` in your `.env.prod` file.
4. Copy the Reddit application's client ID (under "web app" label) and set it as `BACKEND_API_REDDIT_CLIENT_ID` in your `.env.prod` file.
5. Copy the Reddit application's secret and set it as `BACKEND_API_REDDIT_CLIENT_SECRET` in your `.env.prod` file.
6. Generate a random 64-digit hexadecimal string and set it as `BACKEND_API_ENCRYPTION_KEY_HEX` in your `.env.prod` file. One option is to use an online generator such as [this one](https://www.browserling.com/tools/random-hex).


#### Updating

Images are automatically built and pushed to Docker Hub on every commit to the `main` branch, so there is technically no need to pull the latest files in. To update your local instance:

1. Make a backup of your MongoDB data just in case since data migrations may occur
2. Stop containers with `docker compose rm --stop -f`
3. Pull latest images with `docker compose pull`
4. Start containers with `docker compose up -d`

## Migrating from v6

If you've been using MonitoRSS v6 (used by the repo https://github.com/synzen/MonitoRSS-Clone), then these are instructions to migrate off of that repo to use the latest changes.

It's recommended that you don't delete your v6 files until you've confirmed that all your feeds are working as expected post-migration.

1. Follow the instructions above to self host. Be sure to clone this repo - the [clone repo](https://github.com/synzen/MonitoRSS-Clone) is no longer used or maintained.
2. In your `.env.prod` file, set `BACKEND_API_MONGODB_URI` to your MongoDB URI
3. Run `docker compose --parallel 1 up -d --build`
    - If you run into issues with network timeouts, pass the parallel flag to only build 1 container at once: `docker compose --parallel 1 up -d`
5. Access the control panel via http://localhost:8000/servers and convert all your legacy feeds to personal feeds. Legacy feed articles will not be fetched/delivered until they are converted to personal feeds.
6. After verifying that all is working as expected, you may delete your v6 files.
