import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandPing from './ping';
import CommandRemove from './remove';
import CommandVersion from './version';

const mapOfCommands = new Map<string, new () => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
  [CommandRemove.data.name, CommandRemove],
  [CommandVersion.data.name, CommandVersion],
]);

export default mapOfCommands;
