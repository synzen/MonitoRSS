export default interface PartitionedFeedArticleFieldInsert {
  feedId: string;
  fieldName: string;
  fieldHashedValue: string;
  createdAt: Date;
}
