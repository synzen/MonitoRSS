export class DiscordServerNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiscordServerNotFoundException";
  }
}
