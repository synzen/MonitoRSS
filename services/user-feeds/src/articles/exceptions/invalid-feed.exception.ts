export class InvalidFeedException extends Error {
  constructor(message: string, public feedText: string) {
    super(message);
  }
}
