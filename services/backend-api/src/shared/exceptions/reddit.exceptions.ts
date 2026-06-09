import { StandardException } from "./standard.exception";

export class RedditAppRevokedException extends Error {}

export class RedditConnectionRequiredException extends StandardException {}
