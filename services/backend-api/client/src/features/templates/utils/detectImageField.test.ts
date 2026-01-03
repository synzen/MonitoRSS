import { detectImageFields } from "./detectImageField";

describe("detectImageFields", () => {
  describe("basic detection", () => {
    it("returns empty array for empty articles", () => {
      expect(detectImageFields([])).toEqual([]);
    });

    it("returns empty array for null/undefined", () => {
      expect(detectImageFields(null as unknown as Array<Record<string, unknown>>)).toEqual([]);
      expect(detectImageFields(undefined as unknown as Array<Record<string, unknown>>)).toEqual(
        []
      );
    });

    it("detects field with valid image URL", () => {
      const articles = [
        {
          image: "https://example.com/photo.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("detects multiple image fields with different URLs", () => {
      const articles = [
        {
          image: "https://example.com/photo1.jpg",
          thumbnail: "https://example.com/photo2.png",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image", "thumbnail"]);
    });

    it("skips id and idHash fields", () => {
      const articles = [
        {
          id: "https://example.com/photo.jpg",
          idHash: "https://example.com/photo.png",
          image: "https://example.com/actual.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("skips non-image URLs", () => {
      const articles = [
        {
          link: "https://example.com/article",
          image: "https://example.com/photo.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("skips extracted anchor fields even if they contain image URLs", () => {
      const articles = [
        {
          "extracted::description::anchor1":
            "https://nelog.jp/smartnav-4-production-stoppage#comment-95840",
          "extracted::description::anchor4":
            "https://nelog.jp/wp-content/uploads/2025/03/image.png",
          "extracted::description::image1":
            "https://nelog.jp/wp-content/uploads/2025/03/photo.jpg",
        },
      ];
      // Should only detect the image field, not the anchor fields
      expect(detectImageFields(articles)).toEqual(["extracted::description::image1"]);
    });

    it("skips values with whitespace (mixed content)", () => {
      const articles = [
        {
          mixedContent:
            "https://example.com/photo.png?query=1 submitted by /u/Someone [link] [comments]",
          image: "https://example.com/actual.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("skips values with newlines", () => {
      const articles = [
        {
          multiline: "https://example.com/photo.jpg\nSome other text",
          image: "https://example.com/actual.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });
  });

  describe("deduplication", () => {
    it("returns only the shorter field name when two fields have the same URL", () => {
      const articles = [
        {
          image__url: "https://example.com/photo.jpg",
          "media:group__media:thumbnail__@__url": "https://example.com/photo.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image__url"]);
    });

    it("includes both fields when they have different URLs", () => {
      const articles = [
        {
          image__url: "https://example.com/photo1.jpg",
          thumbnail: "https://example.com/photo2.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image__url", "thumbnail"]);
    });

    it("uses alphabetical order as tie-breaker for same-length fields", () => {
      const articles = [
        {
          photo: "https://example.com/img.jpg",
          image: "https://example.com/img.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("handles three fields with same URL", () => {
      const articles = [
        {
          "very:long:field:name": "https://example.com/img.jpg",
          medium_field: "https://example.com/img.jpg",
          img: "https://example.com/img.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["img"]);
    });
  });

  describe("cross-article behavior", () => {
    it("aggregates unique fields across articles", () => {
      const articles = [
        { image: "https://example.com/photo1.jpg" },
        { thumbnail: "https://example.com/photo2.jpg" },
      ];
      expect(detectImageFields(articles)).toEqual(["image", "thumbnail"]);
    });

    it("deduplicates within each article separately", () => {
      const articles = [
        {
          image__url: "https://example.com/photo.jpg",
          "media:group__media:thumbnail__@__url": "https://example.com/photo.jpg",
        },
        {
          image__url: "https://example.com/other.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image__url"]);
    });

    it("handles different duplicates in different articles", () => {
      const articles = [
        {
          img: "https://example.com/a.jpg",
          thumbnail: "https://example.com/a.jpg",
        },
        {
          img: "https://example.com/b.jpg",
          banner: "https://example.com/b.jpg",
        },
      ];
      // Article 1: img vs thumbnail (same URL) -> keeps img (shorter)
      // Article 2: img vs banner (same URL) -> keeps img (shorter)
      // Final result: only img
      expect(detectImageFields(articles)).toEqual(["img"]);
    });

    it("includes multiple fields when URLs differ across articles", () => {
      const articles = [
        {
          img: "https://example.com/a.jpg",
          thumbnail: "https://example.com/a.jpg",
        },
        {
          banner: "https://example.com/c.jpg",
        },
      ];
      // Article 1: img vs thumbnail -> keeps img
      // Article 2: banner is unique
      expect(detectImageFields(articles)).toEqual(["banner", "img"]);
    });
  });

  describe("Reddit CDN deduplication", () => {
    it("deduplicates preview.redd.it and i.redd.it URLs with same filename", () => {
      const articles = [
        {
          image__url: "https://i.redd.it/7azztrbwusag1.png",
          "extracted::description::anchor3":
            "https://preview.redd.it/7azztrbwusag1.png?width=640&crop=smart&auto=webp&s=abc123",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image__url"]);
    });

    it("deduplicates same Reddit image with different query parameters", () => {
      const articles = [
        {
          thumbnail: "https://preview.redd.it/abc123.jpg?width=108&crop=smart",
          image: "https://preview.redd.it/abc123.jpg?width=1080&format=png",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("keeps different Reddit images as separate", () => {
      const articles = [
        {
          image1: "https://i.redd.it/first.png",
          image2: "https://i.redd.it/second.png",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["image1", "image2"]);
    });

    it("deduplicates redditmedia.com URLs by filename", () => {
      const articles = [
        {
          thumb: "https://a.thumbs.redditmedia.com/abc123.jpg",
          full: "https://i.redditmedia.com/abc123.jpg",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["full"]);
    });
  });

  describe("query parameter normalization", () => {
    it("deduplicates same image with different query parameters", () => {
      const articles = [
        {
          thumb: "https://example.com/photo.jpg?size=small",
          full: "https://example.com/photo.jpg?size=large",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["full"]);
    });

    it("deduplicates image with and without query parameters", () => {
      const articles = [
        {
          clean: "https://example.com/photo.jpg",
          withParams: "https://example.com/photo.jpg?v=123",
        },
      ];
      expect(detectImageFields(articles)).toEqual(["clean"]);
    });
  });

  describe("supported image extensions", () => {
    const extensions = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"];

    extensions.forEach((ext) => {
      it(`detects .${ext} files`, () => {
        const articles = [{ image: `https://example.com/photo.${ext}` }];
        expect(detectImageFields(articles)).toEqual(["image"]);
      });
    });

    it("detects URLs with query parameters", () => {
      const articles = [{ image: "https://example.com/photo.jpg?size=large&quality=high" }];
      expect(detectImageFields(articles)).toEqual(["image"]);
    });

    it("handles case-insensitive extensions", () => {
      const articles = [
        { image1: "https://example.com/photo.JPG" },
        { image2: "https://example.com/photo.PNG" },
      ];
      expect(detectImageFields(articles)).toEqual(["image1", "image2"]);
    });
  });
});
