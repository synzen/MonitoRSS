/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { getApplicationContext } from "..";
import { UserFeed, UserFeedModel } from "../../features/user-feeds/entities";
import { getModelToken } from "@nestjs/mongoose";

const DEPRECATED_OPERATORS = ["NOT_CONTAIN", "NOT_CONTAINS", "NOT_EQ"];

function convertFilterExpression(expression: Record<string, any>) {
  if (expression.type === "RELATIONAL") {
    if (expression.op === "NOT_CONTAIN" || expression.op === "NOT_CONTAINS") {
      return {
        ...expression,
        not: true,
        op: "CONTAINS",
      };
    }

    if (expression.op === "NOT_EQ") {
      return {
        ...expression,
        not: true,
        op: "EQ",
      };
    }

    return expression;
  }

  if (expression.type === "LOGICAL") {
    return {
      ...expression,
      children: expression.children.map((child: any) =>
        convertFilterExpression(child)
      ),
    };
  }

  return expression;
}

async function main() {
  try {
    const { app } = await getApplicationContext();

    const userFeeds = app.get<UserFeedModel>(getModelToken(UserFeed.name));

    await userFeeds
      .find()
      .cursor()
      .eachAsync(async (doc) => {
        const stringified = JSON.stringify(doc);

        if (!DEPRECATED_OPERATORS.some((op) => stringified.includes(op))) {
          return;
        }

        let shouldSave = false;

        await Promise.all(
          doc.connections.discordChannels.map(async (c) => {
            if (
              !c.filters?.expression ||
              !DEPRECATED_OPERATORS.some((op) =>
                JSON.stringify(c.filters).includes(op)
              )
            ) {
              return;
            }

            const updated = convertFilterExpression(c.filters?.expression);

            c.filters.expression = updated;

            shouldSave = true;

            c.details.forumThreadTags?.map((tag) => {
              if (!tag.filters) {
                return;
              }

              const tagHasDeprecatedOperators = DEPRECATED_OPERATORS.some(
                (op) => JSON.stringify(tag.filters).includes(op)
              );

              if (!tagHasDeprecatedOperators) {
                return;
              }

              tag.filters.expression = convertFilterExpression(
                tag.filters.expression
              );
            });
          })
        );

        await Promise.all(
          // @ts-ignore
          doc.connections?.["discordWebhooks"]?.map(async (c) => {
            if (
              !c.filters?.expression ||
              !DEPRECATED_OPERATORS.some((op) =>
                JSON.stringify(c.filters).includes(op)
              )
            ) {
              return;
            }

            const updated = convertFilterExpression(c.filters?.expression);

            c.filters.expression = updated;

            shouldSave = true;
          })
        );

        if (shouldSave) {
          // writeFileSync(`./${doc._id}.json`, JSON.stringify(doc, null, 2));
          await doc.save();
        }
      })
      .then(() => {
        console.log("done");
        process.exit(0);
      });
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
