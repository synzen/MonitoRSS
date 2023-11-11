# MonitoRSS (formerly Discord.RSS)

A bot that delivers highly-customized news feeds to Discord.

## Getting Started

### Use Public Instance
To use the public hosted instance for free, visit https://monitorss.xyz!

### Self Host

> [!NOTE]  
>  General knowledge of how Docker, Docker volumes, and docker-compose works is highly recommended to avoid accidental data loss.

1. Install [Docker Engine](https://docs.docker.com/engine/install/)
2. Install [Docker Compose](https://docs.docker.com/compose/install/)
3. Clone this repo
4. Create a copy of the existing `.env.example` file and rename it to `.env.prod`.
5. Replace all relevant values
   1. If you have your own MongoDB instance, set `BACKEND_API_MONGODB_URI` to your MongoDB URI
   2. Replace all instances of "BOT_TOKEN_HERE" with your Discord bot token
   3. Replace all instances of "BOT_CLIENT_ID_HERE" with your Discord bot client ID
   4. Set `BACKEND_API_SESSION_SECRET` to a random 64-character string
   5.  Set `BACKEND_API_SESSION_SALT` to a random 16-character string
   6.  Add `http://localhost:8000/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 page
6.  Run `docker-compose up -d`
7.  Access the control panel via http://localhost:8000

#### Customize Site Domain

1. Set up your domain to point to the server running the control panel on localhost
2. Update all references to `http://localhost:8000` in your `.env.prod` to your desired domain. For example, `https://mynewdomain.com`.
3. Add `{DOMAIN_HERE}/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 pge, replacing `DOMAIN_HERE` with the value you set in step 1

#### Updating

1. Pull the latest files from this repo
2. Rebuild containers with `docker-compose up -d --build`. If containers fail to restart, try running `docker-compose up -d --force-recreate`.
