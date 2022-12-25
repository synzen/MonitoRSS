import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Response {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  statusCode!: number;

  @Column({
    nullable: true,
    type: 'text',
  })
  text?: string | null;

  @Column()
  isCloudflare!: boolean;
}
