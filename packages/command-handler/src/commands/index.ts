import add from './add';
import { Command } from './command.interface';
import ping from './ping';

const mapOfCommands = new Map([
  [ping.data.name, ping],
  [add.data.name, add],
]) as Map<string, Command>;

export default mapOfCommands;
