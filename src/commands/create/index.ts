import { Command } from "commander";
import { execa } from "execa";
import ora from "ora";
import path from "path";
import pc from "picocolors";
import prompts from "prompts";
import { EDITORS, enhancementList, frameworkList, styleSchemeList, variantList } from "../../constants";
import { CreateCommandOption, EditorChoice, Enhancement } from "../../types/index.type";
import { loadTemplate } from "../../utils/load";
import { consolaInstance } from "../../utils/logger";
import { isValidFramework, isValidVariant } from "../../utils/validate";

const detectInstalledEditors = async (): Promise<EditorChoice[]> => {
  const installed: EditorChoice[] = [];

  for (const editor of EDITORS) {
    if (editor.command === "") {
      continue;
    }
    try {
      await execa("which", [editor.command], { stdio: "ignore" });
      installed.push(editor);
    } catch {
      // Editor not installed
    }
  }

  // Always add "Other" option
  installed.push(EDITORS[EDITORS.length - 1]);

  return installed;
};

export const createProjectCommand = () => {
  return new Command("create")
    .argument("[project-name]")
    .option("-f, --framework <framework>", "framework")
    .option("-t, --variant <variant>", "variant")
    .option("-s, --style <style>", "style scheme (css/scss)")
    .option("-r, --remote <remote>", "remote template")
    .description("Create a new project from template")
    .helpOption("-h, --help", "Display help for a command")
    .action(async (projectName: string, option: CreateCommandOption) => {

      if (!projectName) {
        const defaultName = 'peach-project';
        const res = await prompts({
          type: "text",
          name: "name",
          message: "Project name:",
          initial: defaultName,
        })
        projectName = res.name || defaultName;
      }

      let { framework, variant, styleScheme, remote } = option;

      if (remote) {
        // 加载模板
        await loadTemplate({
          remote,
          projectName
        });

        await installDependencies(projectName);
        return;
      }

      if (!framework || !isValidFramework(framework)) {
        // 选择框架
        const response = await prompts({
          type: "select",
          name: "framework",
          message: "Select a framework:",
          choices: frameworkList.map((f) => ({
            title: f,
            value: f,
          })),
        });
        framework = response.framework;
      }

      if (!variant || !isValidVariant(variant)) {
        // 选择框架
        const response = await prompts({
          type: "select",
          name: "variant",
          message: "Select a variant:",
          choices: variantList.map((v) => ({
            title: v,
            value: v,
          })),
        });
        variant = response.variant;
      }

      // 选择样式方案
      if (!styleScheme) {
        const response = await prompts({
          type: "select",
          name: "styleScheme",
          message: "Select a style scheme:",
          choices: styleSchemeList.map((s) => ({
            title: s,
            value: s,
          })),
          initial: 0,
        });
        styleScheme = response.styleScheme;
      }

      // 选择项目增强选项（支持多选）
      const { enhancements } = await prompts({
        type: "multiselect",
        name: "enhancements",
        message: "Select project enhancements (optional):",
        choices: enhancementList.map((e) => ({
          title: e,
          value: e,
        })),
        instructions: pc.dim("Use ↑↓ to navigate · Space to select · Enter to confirm"),
      });

      // 加载模板
      await loadTemplate({
        projectName,
        framework,
        variant,
        styleScheme,
        enhancements: enhancements as Enhancement[],
      });

      await installDependencies(projectName, enhancements as Enhancement[]);
    });
};

const installDependencies = async (projectName: string, enhancements: Enhancement[] = []) => {
  const projectPath = path.join(process.cwd(), projectName);

  const {shouldInstall} = await prompts({
    type: 'confirm',
    name: "shouldInstall",
    message: "Install dependencies now?",
    initial: true
  });

  if(!shouldInstall){
    consolaInstance.log(pc.yellow("You can install dependencies later by running npm/yarn/pnpm install"));
    
    // 即使不安装依赖，也提供打开项目的选项
    await showActionChoices(projectPath, projectName);
    return;
  }

  const { packageManager } = await prompts({
    type: "select",
    name: "packageManager",
    message: "Select a package manager:",
    choices: [
      { title: "npm", value: "npm" },
      { title: "yarn", value: "yarn" },
      { title: "pnpm", value: "pnpm" },
    ],
    initial: 0,
  });

  const spinner = ora(`Installing dependencies with ${packageManager}...`).start();
  try {
    if (packageManager === "yarn") {
      await execa(packageManager, [], { cwd: projectPath, stdio: "ignore" });
    } else {
      await execa(packageManager, ["install"], { cwd: projectPath, stdio: "ignore" });
    }
    spinner.succeed(pc.green("Dependencies installed successfully"));

    // 如果选择了 Oxfmt，静默执行一次 fmt
    if (enhancements.includes("Oxfmt")) {
      try {
        if (packageManager === "yarn") {
          await execa(packageManager, ["fmt"], { cwd: projectPath, stdio: "ignore" });
        } else {
          await execa(packageManager, ["run", "fmt"], { cwd: projectPath, stdio: "ignore" });
        }
      } catch {
        // 静默失败，不影响后续流程
      }
    }

    await showActionChoices(projectPath, projectName, packageManager);
  } catch (err) {
    spinner.fail(pc.red("❌ Failed to install dependencies"));
    console.error(err);
  }
}

const showActionChoices = async (projectPath: string, projectName: string, packageManager?: string) => {
  // 安装完成后，检查是否安装了 Claude Code
  let hasClaudeCode = false;
  try {
    await execa("which", ["claude"], { stdio: "ignore" });
    hasClaudeCode = true;
  } catch {
    // Claude Code not installed
  }

  // 构建 action 选项
  const actionChoices = [
    { title: "Open in editor", value: "editor" },
    { title: "Run the project", value: "run" },
  ];

  // 如果安装了 Claude Code，添加选项
  if (hasClaudeCode) {
    actionChoices.splice(1, 0, { title: "Open with Claude Code", value: "claude" });
  }

  // 如果没有安装依赖，移除运行项目的选项
  if (!packageManager) {
    const runIndex = actionChoices.findIndex(choice => choice.value === "run");
    if (runIndex !== -1) {
      actionChoices.splice(runIndex, 1);
    }
  }

  // 让用户选择下一步操作
  const { action } = await prompts({
    type: "select",
    name: "action",
    message: "What would you like to do next?",
    choices: actionChoices,
    initial: 0,
  });

  if (action === "claude") {
    // 使用 Claude Code 打开项目
    try {
      await execa("claude", [projectPath], { stdio: "inherit" });
      consolaInstance.log(pc.cyan(`\nProject opened with Claude Code: ${projectPath}`));
    } catch (err) {
      consolaInstance.error(pc.red("Failed to open Claude Code"));
    }
  } else if (action === "editor") {
    // 检测已安装的编辑器
    const installedEditors = await detectInstalledEditors();

    const { editor } = await prompts({
      type: "select",
      name: "editor",
      message: "Select an editor to open the project:",
      choices: installedEditors.map((e) => ({
        title: e.title,
        value: e.value,
      })),
    });

    if (editor === "other") {
      const { customEditor } = await prompts({
        type: "text",
        name: "customEditor",
        message: "Enter the editor command (e.g., vim, nano):",
      });

      if (customEditor) {
        try {
          await execa(customEditor, [projectPath], { stdio: "inherit" });
        } catch (err) {
          consolaInstance.error(pc.red(`Failed to open ${customEditor}`));
        }
      }
    } else {
      const selectedEditor = installedEditors.find((e) => e.value === editor);
      if (selectedEditor && selectedEditor.command) {
        try {
          await execa(selectedEditor.command, [projectPath], { stdio: "inherit" });
        } catch (err) {
          consolaInstance.error(pc.red(`Failed to open ${selectedEditor.title}`));
        }
      }
    }

    consolaInstance.log(pc.cyan(`\nProject created at: ${projectPath}`));
    if (packageManager) {
      consolaInstance.log(pc.yellow(`To run the project later, cd ${projectName} and run ${packageManager} run dev`));
    } else {
      consolaInstance.log(pc.yellow(`To run the project, first install dependencies with npm/yarn/pnpm install, then run dev`));
    }
  } else if (action === "run") {
    // 直接运行项目
    if (packageManager) {
      consolaInstance.log(pc.cyan(`\nRunning ${packageManager} run dev...\n`));
      if (packageManager === "yarn") {
        await execa(packageManager, ["dev"], { cwd: projectPath, stdio: "inherit" });
      } else {
        await execa(packageManager, ["run", "dev"], { cwd: projectPath, stdio: "inherit" });
      }
    }
  }
}


