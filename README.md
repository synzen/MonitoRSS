# MonitoRSS (formerly Discord.RSS)

Delivers highly-customized news feeds to Discord!

- [MonitoRSS (formerly Discord.RSS)](#monitorss-formerly-discordrss)
  - [Get Started](#get-started)
    - [Use Public Instance](#use-public-instance)
    - [Self Host](#self-host)
      - [Customize Site Domain](#customize-site-domain)
      - [Updating](#updating)
  - [Migrating from v6](#migrating-from-v6)


## Get Started

### Use Public Instance
To use the publicly hosted instance for free, visit https://monitorss.xyz!

### Self Host

Docker is required to easily coordinate and run multiple services at once.

> [!NOTE]  
>  General knowledge of how Docker, Docker volumes, and docker-compose works is highly recommended to avoid accidental data loss

1. Install [Docker Engine](https://docs.docker.com/engine/install/)
2. Install [Docker Compose](https://docs.docker.com/compose/install/)
3. Clone this repo's `main` (the default) branch - `git clone https://github.com/synzen/MonitoRSS.git`
4. Create a copy of the existing `.env.example` file and rename it to `.env.prod`
5. Create a Discord application through [Discord's developer portal](https://discord.com/developers/applications) if you do not already have one
6. Replace all relevant values
   1. If you have your own MongoDB instance, set `BACKEND_API_MONGODB_URI` to your MongoDB URI
   2. Replace all instances of "BOT_TOKEN_HERE" with your Discord bot application token
   3. Replace all instances of "BOT_CLIENT_ID_HERE" with your Discord bot application ID
   4. Set `BACKEND_API_SESSION_SECRET` to a random 64-character string
   5.  Set `BACKEND_API_SESSION_SALT` to a random 16-character string
   6.  Add `http://localhost:8000/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 page
7.  Run `docker-compose up -d`
8.  Access the control panel via http://localhost:8000

#### Customize Site Domain

1. Set up your domain to point to the server running the control panel on localhost
2. Update all references to `http://localhost:8000` in your `.env.prod` to your desired domain. For example, `https://mynewdomain.com`.
3. Add `{DOMAIN_HERE}/api/v1/discord/callback-v2` to the list of redirect URIs in your Discord application in the OAuth2 page, replacing `DOMAIN_HERE` with the value you set in step 1

#### Updating

1. Pull the latest files from the main branch
2. Rebuild containers with `docker-compose up -d --build`

## Migrating from v6

If you've been using MonitoRSS v6 (used by the repo https://github.com/synzen/MonitoRSS-Clone), then these are instructions to migrate off of that repo to use the latest changes.

It's recommended that you don't delete your v6 files until you've confirmed that all your feeds are working as expected post-migration.

1. Follow the instructions above to self host. Be sure to clone this repo - the [clone repo](https://github.com/synzen/MonitoRSS-Clone) is no longer used or maintained.
2. In your `.env.prod` file, set `BACKEND_API_MONGODB_URI` to your MongoDB URI
3. Run `docker-compose up -d --build`
4. Access the control panel via http://localhost:8000 and convert all your legacy feeds to personal feeds. Legacy feed articles will not be fetched/delivered until they are converted to personal feeds.
