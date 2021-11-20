import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandPing from './ping';

const mapOfCommands = new Map<string, new () => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
]);

export default mapOfCommands;
