# Contributing

**The issue tracker is only for technical support, bug reports and enhancement suggestions.
If you have a question (or any concern related to the public hosting of the bot), please ask it in the [Discord server](https://discord.gg/pudv7Rx) instead of opening an issue.**

If you wish to contribute to the MonitoRSS, feel free to fork the repository and submit a pull request.
ESLint and StandardJS are used to enforce a consistent coding style, so having that set up in your editor of choice is a great boon to your development process.

All development happens on dev branches.

## Directly Work with Core Module

1. Fork & clone this core repo
2. Create a new branch from the **dev** branch
3. Code!
4. Run `npm run eslint` to run ESLint and automatically fix problems in coding style
5. Push your work to your fork and submit a pull request (before that you may need to merge the latest from **upstream**)


## Work with Core Module with Clone Repo

This will allow you to make changes and immediately testing the changes with the clone repo.

1. Fork & clone this core repo
2. In the core repo, create a new branch from the **dev** branch
3. In the core repo, run `npm link` to set up the core dev environment in the global node modules for reference by the clone repo
4. Fork & clone the [clone repository](https://github.com/synzen/MonitoRSS-Clone), and make sure you're on the **dev** branch
5. In the clone repo, set it up by following the setup in documentation
6. In the clone repo, run `npm link monitorss` to create a symlink to the core repo in the global node modules
7. Code in the core repo!
8. In the core repo, run `npm run eslint` to run ESLint and automatically fix problems in coding style
9. In the clone repo, run the bot to test it
10. Push your work to your fork and submit a pull request (before that you may need to merge the latest from **upstream**)

If you use an outdated version of **npm**, then you may run into a [lock file conflict](https://docs.npmjs.com/files/package-locks#resolving-lockfile-conflicts).
More info [here](https://github.com/npm/npm/issues/20434) and [here](https://github.com/npm/npm/issues/20891).

[How do I know which version of **npm** comes with which version of **Node.js** ?](https://nodejs.org/en/download/releases/)
