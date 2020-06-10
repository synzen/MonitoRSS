const Discord = require('discord.js')
const Command = require('../../structs/Command.js')
const Profile = require('../../structs/db/Profile.js')
const DiscordPromptRunner = require('discord.js-prompts').DiscordPromptRunner
const config = require('../../config.js')
const fsPromises = require('fs').promises

jest.mock('../../config.js')
jest.mock('discord.js')
jest.mock('discord.js-prompts')
jest.mock('../../structs/db/Profile.js')

describe('Unit::structs/Command', function () {
  afterEach(function () {
    Command.enabled = true
    jest.restoreAllMocks()
    DiscordPromptRunner.mockReset()
    config.get.mockReset()
    Profile.mockReset()
  })
  describe('enable', function () {
    it('enalbes commands', function () {
      Command.enable()
      expect(Command.enabled).toEqual(true)
    })
  })
  describe('disable', function () {
    it('disables commands', function () {
      Command.disable()
      expect(Command.enabled).toEqual(false)
    })
  })
  describe('isBlacklistedID', function () {
    beforeEach(function () {
      Command.blacklistCache = {
        users: new Set(),
        guilds: new Set()
      }
    })
    afterEach(function () {
      Command.blacklistCache = undefined
    })
    it('returns correctly for blacklisted user', function () {
      const blacklistedUserID = 'q3e5rw2t4ry5t'
      Command.blacklistCache.users.add(blacklistedUserID)
      expect(Command.isBlacklistedID(blacklistedUserID))
        .toEqual(true)
      expect(Command.isBlacklistedID(blacklistedUserID + 'eads'))
        .toEqual(false)
    })
    it('returns correctly for blacklisted guild', function () {
      const blacklistedGuildID = 'q3e5rw2t4ry5t'
      Command.blacklistCache.guilds.add(blacklistedGuildID)
      expect(Command.isBlacklistedID(blacklistedGuildID))
        .toEqual(true)
      expect(Command.isBlacklistedID(blacklistedGuildID + 'eads'))
        .toEqual(false)
    })
  })
  describe('shouldIgnore', function () {
    const log = {
      debug: jest.fn(),
      trace: jest.fn()
    }
    const client = {
      user: {
        id: 'clientid'
      }
    }
    const baseMessage = {
      client,
      channel: {}
    }
    it('returns true if no guild', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id + 'diff'
        }
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(false)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockReturnValue(false)
      expect(Command.shouldIgnore(message, log))
        .toEqual(true)
    })
    it('returns true if message from self', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id
        },
        guild: {}
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(false)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockReturnValue(false)
      expect(Command.shouldIgnore(message, log))
        .toEqual(true)
    })
    it('returns true if active channel', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id + 'abc'
        },
        guild: {}
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(true)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockReturnValue(false)
      expect(Command.shouldIgnore(message, log))
        .toEqual(true)
    })
    it('returns true if blacklisted guild', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id + 'abc'
        },
        guild: {
          id: 'guildid'
        }
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(false)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockImplementation((id) => {
          if (id === message.guild.id) {
            return true
          }
        })
      expect(Command.shouldIgnore(message, log))
        .toEqual(true)
    })
    it('returns true if blacklisted guild', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id + 'abc'
        },
        guild: {}
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(false)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockImplementation((id) => {
          if (id === message.author.id) {
            return true
          }
        })
      expect(Command.shouldIgnore(message, log))
        .toEqual(true)
    })
    it('returns false correctly', function () {
      const message = {
        ...baseMessage,
        author: {
          id: client.user.id + 'abcd'
        },
        guild: {
          id: 'guildidhere'
        }
      }
      jest.spyOn(DiscordPromptRunner, 'isActiveChannel')
        .mockReturnValue(false)
      jest.spyOn(Command, 'isBlacklistedID')
        .mockReturnValue(false)
      expect(Command.shouldIgnore(message, log))
        .toEqual(false)
    })
  })
  describe('isOwnerID', function () {
    it('returns correctly', function () {
      const ownerIDs = ['a', 'b']
      config.get.mockReturnValue({
        bot: {
          ownerIDs
        }
      })
      expect(Command.isOwnerID(ownerIDs[0]))
        .toEqual(true)
      expect(Command.isOwnerID(ownerIDs[0] + 'whatever'))
        .toEqual(false)
    })
  })
  describe('readCommands', function () {
    const originalReaddir = fsPromises.readdir
    beforeEach(function () {
      fsPromises.readdir = jest.fn()
    })
    afterEach(function () {
      fsPromises.readdir = originalReaddir
    })
    it('returns command names', async function () {
      const fileNames = ['a.js', 'c.js', 'folder', 'blah.txt', 'b.js']
      fsPromises.readdir.mockResolvedValue(fileNames)
      await expect(Command.readCommands(false)).resolves
        .toEqual(['a', 'c', 'b'])
    })
  })
  describe('getDefaultPrefix', function () {
    it('returns correctly', function () {
      const prefix = 'afd'
      config.get.mockReturnValue({
        bot: {
          prefix
        }
      })
      expect(Command.getDefaultPrefix())
        .toEqual(prefix)
    })
  })
  describe('getPrefix', function () {
    it('returns profile prefix if it exists', function () {
      const prefix = 'aszdf'
      Profile.getPrefix.mockReturnValue(prefix)
      expect(Command.getPrefix())
        .toEqual(prefix)
    })
    it('returns default prefix if no profile prefix', function () {
      const prefix = 'aszdf'
      Profile.getPrefix.mockReturnValue(undefined)
      jest.spyOn(Command, 'getDefaultPrefix')
        .mockReturnValue(prefix)
      expect(Command.getPrefix())
        .toEqual(prefix)
    })
  })
  describe('parseForName', function () {
    it('returns the string without the prefix', function () {
      const string = 'abcmycomm'
      const prefix = 'abc'
      expect(Command.parseForName(string, prefix))
        .toEqual('mycomm')
    })
    it('returns an empty string if no prefix found', function () {
      const string = 'bcmycomm'
      const prefix = 'abc'
      expect(Command.parseForName(string, prefix))
        .toEqual('')
    })
    it('handles args correctly', function () {
      const string = 'abcmycomm arg1 arg2'
      const prefix = 'abc'
      expect(Command.parseForName(string, prefix))
        .toEqual('mycomm')
    })
  })
  describe('tryGetCommand', function () {
    const log = {
      debug: jest.fn(),
      trace: jest.fn()
    }
    const message = {
      guild: {}
    }
    it('returns the command if profile prefix found', function () {
      const foundCommand = {
        foo: 'bar'
      }
      jest.spyOn(Command, 'getPrefix').mockImplementation()
      jest.spyOn(Command, 'parseForName').mockImplementation()
      jest.spyOn(Command, 'get').mockReturnValue(foundCommand)
      expect(Command.tryGetCommand(message, log))
        .toEqual(foundCommand)
    })
    it('returns the command if no profile prefix but with default prefix', function () {
      const foundCommand = {
        foo: 'bar'
      }
      jest.spyOn(Command, 'getPrefix').mockImplementation()
      jest.spyOn(Command, 'parseForName').mockImplementation()
      jest.spyOn(Command, 'getDefaultPrefix').mockImplementation()
      jest.spyOn(Command, 'get')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(foundCommand)
      expect(Command.tryGetCommand(message, log))
        .toEqual(foundCommand)
    })
  })
  describe('has', function () {
    const orig = Command.commands
    afterEach(function () {
      Command.commands = orig
    })
    it('returns the command if found', function () {
      const commandName = 'hello'
      Command.commands = new Map()
      Command.commands.set(commandName, {})
      expect(Command.has(commandName))
        .toEqual(true)
      expect(Command.has(commandName + 'abc'))
        .toEqual(false)
    })
  })
  describe('get', function () {
    it('gets the command if found', function () {
      const commandName = 'hello'
      const command = {
        fat: 'tony'
      }
      Command.commands = new Map()
      Command.commands.set(commandName, command)
      expect(Command.get(commandName))
        .toEqual(command)
      expect(Command.get(commandName + 'abc'))
        .toEqual(undefined)
    })
  })
  describe('getMemberPermission', function () {
    it('returns the member permissions', function () {
      const commandName = 'qaetswr'
      const permissions = [4445, 223]
      const command = new Command(commandName)
      const userPermissions = {
        [commandName]: permissions
      }
      jest.spyOn(Command, 'USER_PERMISSIONS', 'get')
        .mockReturnValue(userPermissions)
      expect(command.getMemberPermission())
        .toEqual(permissions)
    })
    it('returns the default manage channels perms if no specific perms', function () {
      const commandName = 'qaetswr'
      const command = new Command(commandName)
      expect(command.getMemberPermission())
        .toEqual([Discord.Permissions.FLAGS.MANAGE_CHANNELS])
    })
  })
  describe('getBotPermissions', function () {
    it('returns the bot permissions', function () {
      const commandName = 'qaetswr'
      const permissions = [4445, 223]
      const command = new Command(commandName)
      const botPermissions = {
        [commandName]: permissions
      }
      jest.spyOn(Command, 'BOT_PERMISSIONS', 'get')
        .mockReturnValue(botPermissions)
      expect(command.getBotPermissions())
        .toEqual([
          ...permissions,
          Discord.Permissions.FLAGS.SEND_MESSAGES
        ])
    })
    it('returns the send message perm array if no specific perms', function () {
      const commandName = 'qaetswr'
      const command = new Command(commandName)
      expect(command.getBotPermissions())
        .toEqual([Discord.Permissions.FLAGS.SEND_MESSAGES])
    })
  })
  describe('hasMemberPermission', function () {
    beforeEach(function () {
      jest.spyOn(Command, 'isOwnerID')
        .mockReturnValue(false)
    })
    it('returns whether if member is owner if owner command', function () {
      const command = new Command('', {}, true)
      command.owner = true
      const message = {
        member: {
          user: {}
        },
        channel: {}
      }
      const isOwnerID = true
      jest.spyOn(Command, 'isOwnerID')
        .mockReturnValue(isOwnerID)
      expect(command.hasMemberPermission(message))
        .toEqual(isOwnerID)
      jest.spyOn(Command, 'isOwnerID')
        .mockReturnValue(!isOwnerID)
      expect(command.hasMemberPermission(message))
        .toEqual(!isOwnerID)
    })
    it('returns the resolved permissons', function () {
      const command = new Command()
      command.owner = false
      const has = jest.fn()
      const fetchedMember = {
        user: {},
        permissionsIn: jest.fn().mockReturnValue({
          has
        })
      }
      const message = {
        member: fetchedMember,
        channel: {}
      }
      has.mockReturnValue(true)
      expect(command.hasMemberPermission(message))
        .toEqual(true)
      has.mockReturnValue(false)
      expect(command.hasMemberPermission(message))
        .toEqual(false)
    })
    it('returns true if member is owner', function () {
      const command = new Command('', {}, true)
      command.owner = false
      const message = {
        member: {
          user: {}
        },
        channel: {}
      }
      const isOwnerID = true
      jest.spyOn(Command, 'isOwnerID')
        .mockReturnValue(isOwnerID)
      expect(command.hasMemberPermission(message))
        .toEqual(true)
    })
  })
  describe('hasBotPermission', function () {
    it('returns the resolved permissions', function () {
      const command = new Command()
      jest.spyOn(command, 'getBotPermissions')
        .mockImplementation()
      const has = jest.fn()
      const message = {
        guild: {
          me: {
            permissionsIn: () => ({ has })
          }
        },
        channel: {}
      }
      has.mockReturnValue(true)
      expect(command.hasBotPermission(message))
        .toEqual(true)
      has.mockReturnValue(false)
      expect(command.hasBotPermission(message))
        .toEqual(false)
    })
  })
  describe('run', function () {
    it('calls the func', async function () {
      const command = new Command()
      command.name = 'hello world'
      command.func = jest.fn()
      const message = {
        channel: {}
      }
      await command.run(message)
      expect(command.func)
        .toHaveBeenCalledWith(message, command.name)
    })
    it('adds to the active channel', async function () {
      const command = new Command()
      command.func = jest.fn()
      const message = {
        channel: {
          id: 'abawc'
        }
      }
      await command.run(message)
      expect(DiscordPromptRunner.addActiveChannel)
        .toHaveBeenCalledWith(message.channel.id)
    })
    it('deletes the active channel upon completion', async function () {
      const command = new Command()
      command.func = jest.fn()
      const message = {
        channel: {
          id: 'abawc'
        }
      }
      await command.run(message)
      expect(DiscordPromptRunner.deleteActiveChannel)
        .toHaveBeenCalledWith(message.channel.id)
    })
  })
})
