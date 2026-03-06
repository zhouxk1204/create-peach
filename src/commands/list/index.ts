import { Command } from "commander";
import fs from "fs";
import path, { dirname } from "path";
import pc from "picocolors";
import { fileURLToPath } from "url";
import { frameworkIcon, reverseFrameworkMap } from "../../constants";
import { Framework } from "../../types/index.type";
import { consolaInstance } from "../../utils/logger";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const listCommand = () => {
  return new Command("list")
    .description("List available project templates")
    .action(() => {
      const templateDirPath = path.join(__dirname, "..", "templates");
      const templateList: string[] = fs.readdirSync(templateDirPath);
      consolaInstance.log(
        pc.green(pc.bold("🍑 Create-Peach — Available Templates: "))
      );

      const obj: Record<Framework, string[]> = templateList.reduce(
        (acc, cur) => {
          const framework = reverseFrameworkMap[cur.split("-")[1]];
          if (!acc[framework]) {
            acc[framework] = [cur];
          } else {
            acc[framework].push(cur);
          }
          return acc;
        },
        {} as Record<Framework, string[]>
      );

      const keys = Object.keys(obj) as Framework[];

      keys.forEach((key, index) => {
        if (index !== keys.length) {
          consolaInstance.log("");
        }
        consolaInstance.log(
          frameworkIcon[key].color(`${frameworkIcon[key].icon} ${key}:`)
        );
        const templates = obj[key];
        for (let template of templates) {
          consolaInstance.log(`  • ${template.split("-").slice(1).join("-")}`);
        }
      });
    });
};
