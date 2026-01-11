import React, { createContext, useContext, useMemo, useState, useCallback, ReactNode } from "react";
import {
  getServerMember,
  GetServerMemberOutput,
  getServerRoles,
  getServerChannels,
} from "../features/discordServers/api";
import { DiscordRole } from "../features/discordServers/types/DiscordRole";
import { DiscordServerChannel } from "../features/discordServers/types/DiscordServerChannel";
import { GetDiscordChannelType } from "../features/discordServers/constants";

interface UserData {
  displayName: string;
  avatarUrl?: string | null;
}

interface MentionDataContextType {
  getUser: (userId: string) => UserData | null;
  getRole: (roleId: string) => DiscordRole | null;
  getChannel: (channelId: string) => DiscordServerChannel | null;
  isUserLoading: (userId: string) => boolean;
  isRolesLoading: boolean;
  isChannelsLoading: boolean;
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

export const MentionDataProvider: React.FC<MentionDataProviderProps> = ({ serverId, children }) => {
  const [userCache, setUserCache] = useState<Map<string, UserData | null>>(new Map());
  const [loadingUsers, setLoadingUsers] = useState<Set<string>>(new Set());
  const [fetchedUsers, setFetchedUsers] = useState<Set<string>>(new Set());

  const [rolesMap, setRolesMap] = useState<Map<string, DiscordRole>>(new Map());
  const [isRolesLoading, setIsRolesLoading] = useState(false);
  const [rolesFetched, setRolesFetched] = useState(false);

  const [channelsMap, setChannelsMap] = useState<Map<string, DiscordServerChannel>>(new Map());
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);
  const [channelsFetched, setChannelsFetched] = useState(false);

  const fetchRoles = useCallback(async () => {
    if (!serverId || rolesFetched || isRolesLoading) {
      return;
    }

    setIsRolesLoading(true);

    try {
      const result = await getServerRoles({ serverId });
      const map = new Map<string, DiscordRole>();

      result?.results?.forEach((role: DiscordRole) => {
        map.set(role.id, role);
      });

      setRolesMap(map);
    } catch {
      // Silently fail - roles will show as unknown
    } finally {
      setIsRolesLoading(false);
      setRolesFetched(true);
    }
  }, [serverId, rolesFetched, isRolesLoading]);

  const fetchChannels = useCallback(async () => {
    if (!serverId || channelsFetched || isChannelsLoading) {
      return;
    }

    setIsChannelsLoading(true);

    try {
      const result = await getServerChannels({
        serverId,
        types: [GetDiscordChannelType.All],
      });
      const map = new Map<string, DiscordServerChannel>();

      result?.results?.forEach((channel: DiscordServerChannel) => {
        map.set(channel.id, channel);
      });

      setChannelsMap(map);
    } catch {
      // Silently fail - channels will show as unknown
    } finally {
      setIsChannelsLoading(false);
      setChannelsFetched(true);
    }
  }, [serverId, channelsFetched, isChannelsLoading]);

  const requestRolesFetch = useCallback(() => {
    if (!rolesFetched && !isRolesLoading) {
      fetchRoles();
    }
  }, [fetchRoles, rolesFetched, isRolesLoading]);

  const requestChannelsFetch = useCallback(() => {
    if (!channelsFetched && !isChannelsLoading) {
      fetchChannels();
    }
  }, [fetchChannels, channelsFetched, isChannelsLoading]);

  const fetchUser = useCallback(
    async (userId: string) => {
      if (!serverId || fetchedUsers.has(userId) || loadingUsers.has(userId)) {
        return;
      }

      setLoadingUsers((prev) => new Set(prev).add(userId));

      try {
        const result: GetServerMemberOutput | null = await getServerMember({
          serverId,
          memberId: userId,
        });

        setUserCache((prev) => {
          const newCache = new Map(prev);

          if (result?.result) {
            newCache.set(userId, {
              displayName: result.result.displayName,
              avatarUrl: result.result.avatarUrl,
            });
          } else {
            newCache.set(userId, null);
          }

          return newCache;
        });
      } catch {
        setUserCache((prev) => {
          const newCache = new Map(prev);
          newCache.set(userId, null);

          return newCache;
        });
      } finally {
        setLoadingUsers((prev) => {
          const newSet = new Set(prev);
          newSet.delete(userId);

          return newSet;
        });
        setFetchedUsers((prev) => new Set(prev).add(userId));
      }
    },
    [serverId, fetchedUsers, loadingUsers]
  );

  const requestUserFetch = useCallback(
    (userId: string) => {
      if (!fetchedUsers.has(userId) && !loadingUsers.has(userId)) {
        fetchUser(userId);
      }
    },
    [fetchUser, fetchedUsers, loadingUsers]
  );

  const getUser = useCallback(
    (userId: string): UserData | null => {
      return userCache.get(userId) ?? null;
    },
    [userCache]
  );

  const getRole = useCallback(
    (roleId: string): DiscordRole | null => {
      return rolesMap.get(roleId) ?? null;
    },
    [rolesMap]
  );

  const getChannel = useCallback(
    (channelId: string): DiscordServerChannel | null => {
      return channelsMap.get(channelId) ?? null;
    },
    [channelsMap]
  );

  const isUserLoading = useCallback(
    (userId: string): boolean => {
      return loadingUsers.has(userId);
    },
    [loadingUsers]
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
