import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
export class FeedResponse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    unique: true,
  })
  url!: string;

  @CreateDateColumn({
    type: 'timestamp with time zone',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    type: 'timestamp with time zone',
  })
  updatedAt!: Date;

  @Column({
    type: 'timestamp with time zone',
  })
  lastFetchAttempt!: Date;

  @Column({
    type: 'xml',
  })
  xmlContent!: string;
}
