export interface GetUserOutputDto {
  result: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}
