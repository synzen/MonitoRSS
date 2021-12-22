import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandInvite from './invite';
import CommandList from './list';
import CommandLocale from './locale';
import CommandPatron from './patron';
import CommandPing from './ping';
import CommandRefresh from './refresh';
import CommandRemove from './remove';
import CommandVersion from './version';

const mapOfCommands = new Map<string, new () => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
  [CommandRemove.data.name, CommandRemove],
  [CommandVersion.data.name, CommandVersion],
  [CommandInvite.data.name, CommandInvite],
  [CommandLocale.data.name, CommandLocale],
  [CommandPatron.data.name, CommandPatron],
  [CommandRefresh.data.name, CommandRefresh],
  [CommandList.data.name, CommandList],
]);

export default mapOfCommands;
