import { Types } from "mongoose";
import {
  UserExternalCredentialStatus,
  UserExternalCredentialType,
} from "../shared/enums";

// Users and workspaces embed external credentials (reddit grants) as
// structurally identical subdocument arrays. The write operations and the
// credential-state query fragments live here so both repositories share one
// implementation; the full aggregation pipelines stay per-repository because
// their lookup directions and missing-owner semantics differ.

export const REDDIT_URL_REGEX = /^http(s?):\/\/(www.)?(\w+\.)?reddit\.com\/r\//i;

interface CredentialHostModel {
  updateOne(
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
  ): PromiseLike<{ modifiedCount: number }>;
}

// Update-in-place when a credential of this type exists, else push a new
// subdocument. A (re-)connect or refresh produces fresh, valid tokens: a
// previously revoked/expired credential is active again. Without this the
// record keeps its prior REVOKED status and the UI never leaves the
// disconnected state after reconnecting.
export async function upsertExternalCredential({
  model,
  ownerFilter,
  credential,
  extraFields,
}: {
  model: CredentialHostModel;
  ownerFilter: Record<string, unknown>;
  credential: {
    type: UserExternalCredentialType;
    data: Record<string, string>;
    expireAt?: Date;
  };
  // Owner-specific subdocument fields (e.g. workspace connection attribution).
  extraFields?: Record<string, unknown>;
}): Promise<void> {
  const dataSetQueries = Object.entries(credential.data).reduce(
    (acc, [key, value]) => {
      acc[`externalCredentials.$.data.${key}`] = value;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  const extraSetQueries = Object.entries(extraFields ?? {}).reduce(
    (acc, [key, value]) => {
      acc[`externalCredentials.$.${key}`] = value;
      return acc;
    },
    {} as Record<string, unknown>,
  );

  const result = await model.updateOne(
    {
      ...ownerFilter,
      externalCredentials: {
        $elemMatch: { type: credential.type },
      },
    },
    {
      $set: {
        ...dataSetQueries,
        ...extraSetQueries,
        ...(credential.expireAt && {
          "externalCredentials.$.expireAt": credential.expireAt,
        }),
        "externalCredentials.$.status": UserExternalCredentialStatus.Active,
      },
    },
  );

  if (!result.modifiedCount) {
    await model.updateOne(ownerFilter, {
      $push: {
        externalCredentials: {
          type: credential.type,
          data: credential.data,
          expireAt: credential.expireAt,
          status: UserExternalCredentialStatus.Active,
          ...extraFields,
        },
      },
    });
  }
}

export async function removeExternalCredentialsByType({
  model,
  ownerFilter,
  type,
}: {
  model: CredentialHostModel;
  ownerFilter: Record<string, unknown>;
  type: UserExternalCredentialType;
}): Promise<void> {
  await model.updateOne(ownerFilter, {
    $pull: { externalCredentials: { type } },
  });
}

export async function revokeExternalCredentialById({
  model,
  ownerFilter,
  credentialId,
}: {
  model: CredentialHostModel;
  ownerFilter: Record<string, unknown>;
  credentialId: Types.ObjectId;
}): Promise<void> {
  await model.updateOne(
    {
      ...ownerFilter,
      "externalCredentials._id": credentialId,
    },
    {
      $set: {
        "externalCredentials.$.status": UserExternalCredentialStatus.Revoked,
      },
    },
  );
}

// Lean reads surface subdocument Maps either as Maps or plain objects
// depending on the query path; normalize to a plain record.
export function normalizeExternalCredentialData(
  data: unknown,
): Record<string, string> {
  if (!data) {
    return {};
  }

  if (data instanceof Map) {
    return Object.fromEntries(data);
  }

  return data as Record<string, string>;
}

// Owners holding a reddit credential that is currently usable for fetching.
export function activeRedditCredentialElemMatch(): Record<string, unknown> {
  return {
    externalCredentials: {
      $elemMatch: {
        expireAt: { $gt: new Date() },
        status: UserExternalCredentialStatus.Active,
        type: UserExternalCredentialType.Reddit,
      },
    },
  };
}

// $or branches matching a credential holder (at `holderPath` after a lookup)
// whose reddit grant can no longer fetch: no credentials at all, expired, or
// revoked. Missing-holder semantics differ per owner kind, so callers add
// their own null-holder condition.
export function expiredOrRevokedRedditCredentialConditions(
  holderPath: string,
): Array<Record<string, unknown>> {
  const credentialsPath = `${holderPath}.externalCredentials`;

  return [
    { [`${credentialsPath}.0`]: { $exists: false } },
    {
      [credentialsPath]: {
        $elemMatch: {
          type: UserExternalCredentialType.Reddit,
          expireAt: { $lte: new Date() },
        },
      },
    },
    {
      [credentialsPath]: {
        $elemMatch: {
          type: UserExternalCredentialType.Reddit,
          status: UserExternalCredentialStatus.Revoked,
        },
      },
    },
  ];
}

// Owners whose active reddit grant expires soon enough for the scheduled
// refresh sweep to renew it.
export function expiringActiveRedditCredentialFilter(
  expirationThreshold: Date,
): Record<string, unknown> {
  return {
    externalCredentials: {
      $elemMatch: {
        type: UserExternalCredentialType.Reddit,
        status: UserExternalCredentialStatus.Active,
        "data.accessToken": { $exists: true },
        "data.refreshToken": { $exists: true },
        expireAt: {
          $exists: true,
          $lte: expirationThreshold,
        },
      },
    },
  };
}

// Plucks the reddit refresh token off a lean owner doc for the refresh sweep.
export function extractRedditRefreshCredential(doc: {
  externalCredentials?: Array<{
    _id?: Types.ObjectId;
    type: string;
    data?: unknown;
  }>;
}): { credentialId: Types.ObjectId; encryptedRefreshToken: string } | null {
  const redditCredential = doc.externalCredentials?.find(
    (c) => c.type === UserExternalCredentialType.Reddit,
  );

  if (!redditCredential?._id) {
    return null;
  }

  const refreshToken = normalizeExternalCredentialData(
    redditCredential.data,
  ).refreshToken;

  if (!refreshToken) {
    return null;
  }

  return {
    credentialId: redditCredential._id,
    encryptedRefreshToken: refreshToken,
  };
}
