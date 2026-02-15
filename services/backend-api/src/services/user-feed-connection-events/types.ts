export interface CreatedEvent {
  feedId: string;
  connectionId: string;
  creator: {
    discordUserId: string;
  };
}

export interface ShareManageOptions {
  invites?: Array<{
    discordUserId: string;
    connections?: Array<{ connectionId: string }>;
  }>;
}

export interface DeletedEvent {
  feedId: string;
  deletedConnectionIds: string[];
  shareManageOptions?: ShareManageOptions;
}
