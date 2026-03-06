import { program } from "commander";
import pkg from '../../package.json';

import { createProjectCommand } from "./create";
import { infoCommand } from "./info/index";
import { listCommand } from "./list";
import { registerCommand } from "./register-command";
// -v
program
  .name('peach')
  .version(pkg.version, '-v, --version', 'Show Create-Peach information')
  // .addHelpText(
  //   'beforeAll',
  //   picocolors.green('\n🍑 Create-Peach - Efficient frontend project scaffolding tool\n')
  // )
  // .addHelpText(
  //   'afterAll',
  //   picocolors.yellow('\nFor more information, visit https://github.com/zhouxk1204/create-peach\n')
  // );

// register info command
registerCommand(infoCommand);
registerCommand(createProjectCommand);  
registerCommand(listCommand);
