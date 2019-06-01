function getArticleId (articleList, article) {
  const equalGuids = articleList.length > 1 && articleList[0].guid && articleList[1].guid === articleList[0].guid

  if ((!article.guid || equalGuids) && article.date) return article.date
  if ((!article.guid || equalGuids) && article.title) return article.title
  return article.guid
}

export default getArticleId
