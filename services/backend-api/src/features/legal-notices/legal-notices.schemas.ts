import { z } from "zod";

export const LEGAL_DOCUMENT_TYPES = ["terms", "privacy-policy"] as const;

const LegalDocumentSchema = z.object({
  type: z.enum(LEGAL_DOCUMENT_TYPES),
  url: z
    .string()
    .url()
    .refine((value) => new URL(value).protocol === "https:", {
      message: "Document URLs must use HTTPS",
    }),
});

export const LegalNoticeSchema = z
  .object({
    version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Version must use YYYY-MM-DD"),
    displayAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    effectiveAt: z.string().datetime({ offset: true }).transform((value) => new Date(value)),
    summary: z.string().trim().min(1).max(1_000),
    documents: z.array(LegalDocumentSchema).min(1),
  })
  .superRefine((notice, ctx) => {
    if (notice.displayAt > notice.effectiveAt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Display timestamp must not be after the effective timestamp",
        path: ["displayAt"],
      });
    }

    const documentTypes = new Set<string>();

    for (const [index, document] of notice.documents.entries()) {
      if (documentTypes.has(document.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Document types must be unique",
          path: ["documents", index, "type"],
        });
      }
      documentTypes.add(document.type);
    }
  });

export type LegalNotice = z.infer<typeof LegalNoticeSchema>;
