import { useContext } from "react";
import { FaDiscord } from "react-icons/fa";
import { ArticleSelectDialog, useUserFeedConnectionContext } from "@/features/feed";
import { SendTestArticleContext } from "../../../messageBuilder/contexts/SendTestArticleContext";
import { usePageAlertContext } from "@/contexts/PageAlertContext";
import { PrimaryActionButton } from "@/components/PrimaryActionButton";

export const SendConnectionTestArticleButton = () => {
  const { userFeed, connection, articleFormatOptions } = useUserFeedConnectionContext();
  const { sendTestArticle, isFetching } = useContext(SendTestArticleContext);
  const { createErrorAlert, createSuccessAlert, createInfoAlert } = usePageAlertContext();

  const onClick = async (articleId?: string) => {
    if (!articleId) {
      return;
    }

    try {
      const resultInfo = await sendTestArticle(
        {
          connectionType: connection.key,
          previewInput: {
            feedId: userFeed.id,
            connectionId: connection.id,
            data: {
              article: {
                id: articleId,
              },
            },
          },
        },
        {
          disableToast: true,
        },
      );

      if (resultInfo?.status === "error") {
        createErrorAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "success") {
        createSuccessAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      } else if (resultInfo?.status === "info") {
        createInfoAlert({
          title: resultInfo.title,
          description: resultInfo.description,
        });
      }
    } catch (err) {
      createErrorAlert({
        title: "Failed to send article to Discord.",
        description: (err as Error).message,
      });
    }
  };

  return (
    <ArticleSelectDialog
      articleFormatOptions={articleFormatOptions}
      feedId={userFeed.id}
      trigger={
        <PrimaryActionButton variant="solid" loading={isFetching}>
          <FaDiscord fontSize={24} />
          <span>Send Article to Discord</span>
        </PrimaryActionButton>
      }
      onArticleSelected={onClick}
      onClickRandomArticle={onClick}
    />
  );
};
