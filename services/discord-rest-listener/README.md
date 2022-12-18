# Discord-REST-Listener

A queue that takes incoming Discord API requests (that are messages sent to servers), and then magically handles all rate limiting information that Discord returns.

This is specially designed for https://github.com/synzen/MonitoRSS, and meant to be used with https://github.com/MonitoRSS/Discord-REST.

A `.env` file should be made

```
TOKEN=
DATABASE_URI=
MAX_REQUESTS_PER_SECOND=
RABBITMQ_URI=
DISCORD_CLIENT_ID
```
