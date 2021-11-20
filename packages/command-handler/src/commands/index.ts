import { Container } from 'inversify';
import CommandAdd from './add';
import CommandInterface from './command.interface';
import CommandPing from './ping';

const mapOfCommands = new Map<string, new (container: Container) => CommandInterface>([
  [CommandPing.data.name, CommandPing],
  [CommandAdd.data.name, CommandAdd],
]);

export default mapOfCommands;
