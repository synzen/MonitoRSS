interface Placeholder {
  name: string;
  value: string;
}

interface FeedArticle {
  id: string;
  title: string;
  placeholders: {
    public: Placeholder[];
    private: Placeholder[];
    regex: Placeholder[];
    raw: Placeholder[];
  };
}

export interface GetFeedArticlesOutputDto {
  result: FeedArticle[];
}
