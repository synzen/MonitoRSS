import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  RequestFetchOptions,
  RequestResponseDetails,
  RequestResponseStatus,
} from '../constants';

@Entity()
export class RequestResponse {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: RequestResponseStatus,
  })
  status!: RequestResponseStatus;

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  fetchOptions?: RequestFetchOptions | null;

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
  responseDetails!: RequestResponseDetails;
}
