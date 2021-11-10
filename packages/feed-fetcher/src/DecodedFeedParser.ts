
import FeedParser from 'feedparser';
import * as iconv from 'iconv-lite';

// Ignore ts TS warning that doesn't allow us to override the base _transform method
// @ts-ignore
class DecodedFeedParser extends FeedParser {
  constructor(
    options: FeedParser.Options = {},
    private url: string,
    private charset: string = 'utf8',
  ) {
    super(options);
  }

  private _transform(chunk: any, encoding: string, done: () => any): void {
    const charset = this.charset; // config.feeds.decode[this.url] || this.charset;

    if (/utf-*8/i.test(charset) || !charset || !iconv.encodingExists(charset)) {
      this.stream.write(chunk);
    } else {
      // Assumes that the encoding specified is valid, and will not check via iconv.encodingExists()
      this.stream.write(iconv.decode(chunk, charset));
    }

    done();
  }
}

export default DecodedFeedParser;
