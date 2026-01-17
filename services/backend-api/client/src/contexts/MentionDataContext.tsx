import React, { createContext, useContext, useMemo, useCallback, ReactNode, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getServerMember, getServerRoles, getServerChannels } from "../features/discordServers/api";
import { DiscordRole } from "../features/discordServers/types/DiscordRole";
import { DiscordServerChannel } from "../features/discordServers/types/DiscordServerChannel";
import {
  GetDiscordChannelType,
  discordServerQueryKeys,
} from "../features/discordServers/constants";

export interface UserData {
  displayName: string;
  avatarUrl?: string | null;
}

export interface MentionResolvers {
  getUser: (userId: string) => UserData | null;
  getRole: (roleId: string) => DiscordRole | null;
  getChannel: (channelId: string) => DiscordServerChannel | null;
  isUserLoading: (userId: string) => boolean;
  isRolesLoading: boolean;
  isChannelsLoading: boolean;
}

interface MentionDataContextType extends MentionResolvers {
  requestUserFetch: (userId: string) => void;
  requestRolesFetch: () => void;
  requestChannelsFetch: () => void;
}

const MentionDataContext = createContext<MentionDataContextType | undefined>(undefined);

export const useMentionData = () => {
  const context = useContext(MentionDataContext);

  if (!context) {
    throw new Error("useMentionData must be used within a MentionDataProvider");
  }

  return context;
};

interface MentionDataProviderProps {
  serverId?: string;
  children: ReactNode;
}

interface RolesResponse {
  results?: DiscordRole[];
}

interface ChannelsResponse {
  results?: DiscordServerChannel[];
}

export const MentionDataProvider: React.FC<MentionDataProviderProps> = ({ serverId, children }) => {
  const queryClient = useQueryClient();

  // Track loading states for users (React Query doesn't expose this for prefetch)
  const [loadingUserIds, setLoadingUserIds] = useState<Set<string>>(new Set());
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);

  const requestUserFetch = useCallback(
    (userId: string) => {
      if (!serverId) return;

      const queryKey = discordServerQueryKeys.serverMember(serverId, userId);

      // Check if already cached or loading
      const existingData = queryClient.getQueryData(queryKey);
      const existingState = queryClient.getQueryState(queryKey);

      if (existingData !== undefined || existingState?.fetchStatus === "fetching") {
        return;
      }

      setLoadingUserIds((prev) => new Set(prev).add(userId));

      queryClient
        .fetchQuery({
          queryKey: [...queryKey],
          queryFn: async () => {
            const result = await getServerMember({ serverId, memberId: userId });

            return result?.result ? { displayName: result.result.displayName } : null;
          },
        })
        .finally(() => {
          setLoadingUserIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);

            return next;
          });
        });
    },
    [serverId, queryClient]
  );

  const requestRolesFetch = useCallback(() => {
    if (!serverId) return;

    const queryKey = discordServerQueryKeys.serverRoles(serverId);

    const existingData = queryClient.getQueryData(queryKey);
    const existingState = queryClient.getQueryState(queryKey);

    if (existingData !== undefined || existingState?.fetchStatus === "fetching") {
      return;
    }

    setIsRolesLoading(true);

    queryClient
      .fetchQuery({
        queryKey: [...queryKey],
        queryFn: () => getServerRoles({ serverId }),
      })
      .finally(() => {
        setIsRolesLoading(false);
      });
  }, [serverId, queryClient]);

  const requestChannelsFetch = useCallback(() => {
    if (!serverId) return;

    const queryKey = discordServerQueryKeys.allChannels(serverId);

    const existingData = queryClient.getQueryData(queryKey);
    const existingState = queryClient.getQueryState(queryKey);

    if (existingData !== undefined || existingState?.fetchStatus === "fetching") {
      return;
    }

    setIsChannelsLoading(true);

    queryClient
      .fetchQuery({
        queryKey: [...queryKey],
        queryFn: () => getServerChannels({ serverId, types: [GetDiscordChannelType.All] }),
      })
      .finally(() => {
        setIsChannelsLoading(false);
      });
  }, [serverId, queryClient]);

  const getUser = useCallback(
    (userId: string): UserData | null => {
      if (!serverId) return null;

      const data = queryClient.getQueryData<UserData | null>(
        discordServerQueryKeys.serverMember(serverId, userId)
      );

      return data ?? null;
    },
    [serverId, queryClient]
  );

  const getRole = useCallback(
    (roleId: string): DiscordRole | null => {
      if (!serverId) return null;

      const data = queryClient.getQueryData<RolesResponse>(
        discordServerQueryKeys.serverRoles(serverId)
      );

      return data?.results?.find((role) => role.id === roleId) ?? null;
    },
    [serverId, queryClient]
  );

  const getChannel = useCallback(
    (channelId: string): DiscordServerChannel | null => {
      if (!serverId) return null;

      const data = queryClient.getQueryData<ChannelsResponse>(
        discordServerQueryKeys.allChannels(serverId)
      );

      return data?.results?.find((channel) => channel.id === channelId) ?? null;
    },
    [serverId, queryClient]
  );

  const isUserLoading = useCallback(
    (userId: string): boolean => {
      return loadingUserIds.has(userId);
    },
    [loadingUserIds]
  );

  const contextValue: MentionDataContextType = useMemo(
    () => ({
      getUser,
      getRole,
      getChannel,
      isUserLoading,
      isRolesLoading,
      isChannelsLoading,
      requestUserFetch,
      requestRolesFetch,
      requestChannelsFetch,
    }),
    [
      getUser,
      getRole,
      getChannel,
      isUserLoading,
      isRolesLoading,
      isChannelsLoading,
      requestUserFetch,
      requestRolesFetch,
      requestChannelsFetch,
    ]
  );

  return <MentionDataContext.Provider value={contextValue}>{children}</MentionDataContext.Provider>;
};
