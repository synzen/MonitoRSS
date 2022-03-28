import { StandardException } from './standard-exception.exception';

describe('StandardException', () => {
  it('can initialize with a string message', () => {
    const message = 'test message';
    const exception = new StandardException(message);

    expect(exception.message).toBe(message);
    expect(exception.subErrors).toHaveLength(0);
  });

  it('can initialize with an array of sub errors', () => {
    const subErrors = [new StandardException(), new StandardException()];
    const exception = new StandardException(subErrors);

    expect(exception.subErrors).toBe(subErrors);
  });
});
