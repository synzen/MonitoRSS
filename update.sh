#!/usr/bin/env bash

GITHUB_USER=$(cut -d/ -f1 <<< "$GITHUB_REPO")
repo_temp=$(mktemp -d)
push_uri="https://$GITHUB_USER:$GITHUB_SECRET_TOKEN@github.com/$GITHUB_REPO"

git config --global user.email "updater@updater" && git config --global user.name "ForkUpdater"

git clone "https://github.com/$GITHUB_REPO" "$repo_temp"
cd "$repo_temp"

git checkout -b upstream $GITHUB_REPO_BRANCH
git pull --no-edit https://github.com/$UPSTREAM_REPO $UPSTREAM_BRANCH

CONFLICTS=$(git ls-files -u | wc -l)
if [ "$CONFLICTS" -gt 0 ] ; then
    echo "There is a merge conflict. Aborting"
    git merge --abort
    conflictcheck=$(curl https://api.github.com/search/issues\?q\=is:issue+is:open+repo:$GITHUB_REPO+author:$GITHUB_USER+label:merge-conflict | python -c 'import json,sys;obj=json.load(sys.stdin);print obj["total_count"]') # I would use jq, but to minimize deps, I'll use a dirty way
    if [ $conflictcheck -eq 0 ] ; then
        curl -u $GITHUB_USER:$GITHUB_SECRET_TOKEN -H "Content-Type: application/json" -X POST -d '{"title": "Merge conflict detected", "body": "ForkUpdater could not update your repo. Please check for merge conflicts and update manually!","labels": ["merge-conflict"]}' https://api.github.com/repos/$GITHUB_REPO/issues
    fi
    exit 1
fi

git checkout $GITHUB_REPO_BRANCH
git merge --no-edit --no-ff upstream

# Redirect to /dev/null to avoid secret leakage
git push "$push_uri" $GITHUB_REPO_BRANCH >/dev/null 2>&1
