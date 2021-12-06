import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandInvite from './invite';
import CommandLocale from './locale';
import CommandPing from './ping';
import CommandRemove from './remove';
import CommandVersion from './version';

const mapOfCommands = new Map<string, new () => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
  [CommandRemove.data.name, CommandRemove],
  [CommandVersion.data.name, CommandVersion],
  [CommandInvite.data.name, CommandInvite],
  [CommandLocale.data.name, CommandLocale],
]);

export default mapOfCommands;
