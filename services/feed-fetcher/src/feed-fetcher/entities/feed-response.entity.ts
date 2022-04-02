import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  FeedFetchOptions,
  FeedResponseDetails,
  FeedResponseStatus,
} from '../constants';

@Entity()
export class FeedResponse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: FeedResponseStatus,
  })
  status!: FeedResponseStatus;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  fetchOptions?: FeedFetchOptions | null;

  @Column({
    unique: true,
  })
  url!: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  @Column({
    type: 'jsonb',
  })
  responseDetails!: FeedResponseDetails;
}
