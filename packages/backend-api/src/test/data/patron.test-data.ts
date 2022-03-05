import { Types } from 'mongoose';
import {
  Patron,
  PatronStatus,
} from '../../features/supporters/entities/patron.entity';

const boilerplate: Patron = {
  _id: new Types.ObjectId(),
  email: 'email@email.com',
  name: 'name',
  pledge: 100,
  pledgeLifetime: 100,
  status: PatronStatus.ACTIVE,
};

export const createTestPatron = (overrides: Partial<Patron> = {}): Patron => ({
  ...boilerplate,
  ...overrides,
});
