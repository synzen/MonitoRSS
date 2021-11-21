import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandPing from './ping';
import CommandRemove from './remove';

const mapOfCommands = new Map<string, new () => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
  [CommandRemove.data.name, CommandRemove],
]);

export default mapOfCommands;
