# Contributing

**The issue tracker is only for technical support, bug reports and enhancement suggestions.
If you have a question, please ask it in the [Discord server](https://discord.gg/pudv7Rx) instead of opening an issue.**

If you wish to contribute to the Discord.RSS, feel free to fork the repository and submit a pull request.
We use ESLint + StandardJS to enforce a consistent coding style, so having that set up in your editor of choice is a great boon to your development process.

All development happens on dev branches.

## Setup

To get ready to work on the codebase, please do the following:

1. Fork & clone the repository, and make sure you're on the **dev** branch
2. Run `npm install`
3. Create a `.env` file in the root (or `.env.` if you're on Windows, which will automatically become `.env`) and copy the necessary variables there from the `.env.example`
4. Create a new branch to work on
5. Code
6. Run `npm run eslint` to run ESLint and automatically fix problems in coding style
7. Run `npm run dev` (or `heroku local` if you prefer Heroku CLI) to test run the bot
8. Push your work to your fork and submit a pull request (before that you may need to merge the latest from **upstream**)

If you use an outdated version of **npm**, then you may run into a [lock file conflict](https://docs.npmjs.com/files/package-locks#resolving-lockfile-conflicts).
More info [here](https://github.com/npm/npm/issues/20434) and [here](https://github.com/npm/npm/issues/20891).

[How do I know which version of **npm** comes with which version of **Node.js** ?](https://nodejs.org/en/download/releases/)
