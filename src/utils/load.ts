import { execa } from "execa";
import {
  copy,
  mkdir,
  move,
  readdir,
  readFile,
  readJson,
  remove,
  writeFile,
  writeJson
} from "fs-extra";
import { downloadTemplate } from "giget";
import ora from "ora";
import path, { dirname } from "path";
import pc from "picocolors";
import { fileURLToPath } from "url";
import { frameworkMap, variantMap } from "../constants";
import {
  Enhancement,
  Framework,
  StyleScheme,
  Variant,
} from "../types/index.type";
import { consolaInstance } from "./logger";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type LoadLocalTemplateOption = {
  remote?: undefined;
  projectName: string;
  variant: Variant;
  framework: Framework;
  styleScheme?: StyleScheme;
  enhancements?: Enhancement[];
};

export type LoadRemoteTemplateOption = {
  remote: string;
  projectName: string;
  variant?: never;
  framework?: never;
  styleScheme?: never;
  enhancements?: never;
};

export type LoadTemplateOption =
  | LoadLocalTemplateOption
  | LoadRemoteTemplateOption;

export const loadTemplate = async (option: LoadTemplateOption) => {
  const { remote } = option;

  if (remote) {
    return await loadRemoteTemplate(option as LoadRemoteTemplateOption);
  } else {
    return await loadLocalTemplate(option as LoadLocalTemplateOption);
  }
};

const loadLocalTemplate = async (option: LoadLocalTemplateOption) => {
  const {
    projectName,
    variant,
    framework,
    styleScheme = "CSS",
    enhancements = [],
  } = option;

  // 找到templatePath
  const templatePath = path.join(
    __dirname,
    "..",
    "templates",
    `template-${frameworkMap[framework]}-${variantMap[variant]}`,
  );

  // 拷贝到cli执行下面的路径process.cwd
  await copy(templatePath, `${process.cwd()}/${projectName}`);
  // update package.json
  await updatePackageJson(projectName);

  // 如果选择了 SCSS，进行文件转换
  if (styleScheme === "SCSS") {
    await convertToScss(projectName, variant);
  }

  // 处理增强选项
  if (enhancements.length > 0) {
    await applyEnhancements(projectName, enhancements, styleScheme, variant);
  }

  // 更新 App.vue 中的 featureCards
  await updateAppVueFeatureCards(projectName, framework, variant, enhancements);
};

const loadRemoteTemplate = async (option: LoadRemoteTemplateOption) => {
  const { projectName, remote } = option;

  const cliPath = process.cwd();
  // 解压后的目录路径
  const { dir } = await downloadTemplate(remote ?? "", {
    dir: `${cliPath}/.temp`,
  });

  await copy(dir, `${cliPath}/${projectName}`);
  await updatePackageJson(projectName);

  // 删除模板
  await remove(dir);
};

const updatePackageJson = async (projectName: string) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;
  const originalPackageJson = await readJson(`${projectRootPath}/package.json`);

  await writeJson(
    `${projectRootPath}/package.json`,
    {
      ...originalPackageJson,
      name: projectName,
      version: "1.0.0",
    },
    { spaces: 2 },
  );
};

const convertToScss = async (projectName: string, variant: Variant) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 找到并重命名 style.css 为 style.scss
  await renameStyleFile(projectRootPath);

  // 2. 修改 main.ts/js 中的 import 语句
  await updateMainImport(projectRootPath, variant);

  // 3. 修改所有 .vue 文件中的 <style> 标签
  await updateVueStyleTags(projectRootPath);

  // 4. 更新 package.json，添加 sass 和 sass-loader
  await addScssDependencies(projectRootPath);

  // 5. 添加 SCSS 预处理器配置到 vite.config
  await addScssPreprocessorConfig(projectRootPath, variant);
};

const renameStyleFile = async (projectRootPath: string) => {
  const possiblePaths = [
    path.join(projectRootPath, "src", "style.css"),
    path.join(projectRootPath, "style.css"),
    path.join(projectRootPath, "src", "styles", "style.css"),
  ];

  for (const oldPath of possiblePaths) {
    try {
      const newPath = oldPath.replace(/\.css$/, ".scss");
      await move(oldPath, newPath);
      break;
    } catch {
      // 文件不存在，继续尝试下一个路径
    }
  }
};

const updateMainImport = async (projectRootPath: string, variant: Variant) => {
  const ext = variantMap[variant];
  const mainFile = path.join(projectRootPath, "src", `main.${ext}`);

  try {
    let content = await readFile(mainFile, "utf-8");
    content = content.replace(
      /import\s+['"]\.\/style\.css['"]/,
      "import './style.scss'",
    );
    await writeFile(mainFile, content);
  } catch {
    // 文件不存在，静默处理
  }
};

const updateVueStyleTags = async (projectRootPath: string) => {
  const srcDir = path.join(projectRootPath, "src");
  const vueFiles: string[] = [];

  // 递归查找所有 .vue 文件
  const findVueFiles = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await findVueFiles(fullPath);
      } else if (entry.name.endsWith(".vue")) {
        vueFiles.push(fullPath);
      }
    }
  };

  try {
    await findVueFiles(srcDir);
  } catch {
    // src 目录可能不存在
  }

  // 修改每个 .vue 文件中的 <style> 标签
  for (const vueFile of vueFiles) {
    try {
      let content = await readFile(vueFile, "utf-8");
      // 替换 <style scoped> 为 <style scoped lang="scss">
      // 同时也处理没有 scoped 的情况
      content = content.replace(
        /<style\s+scoped\s*>/g,
        '<style scoped lang="scss">',
      );
      content = content.replace(/<style\s*>/g, '<style lang="scss">');
      await writeFile(vueFile, content);
    } catch (err) {
      // 忽略错误，静默处理
    }
  }
};

const getLatestStableVersion = async (
  packageName: string,
): Promise<string | null> => {
  try {
    const response = await fetch(`https://registry.npmjs.org/${packageName}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    // 获取最新稳定版本（排除 pre-release 和 beta 版本）
    const distTags = data["dist-tags"];
    const latestVersion = distTags?.latest;
    return latestVersion || null;
  } catch {
    return null;
  }
};

const addScssDependencies = async (projectRootPath: string) => {
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  // 确保存在 devDependencies
  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  // 获取 sass 和 sass-loader 的最新版本
  const [sassVersion, sassLoaderVersion] = await Promise.all([
    getLatestStableVersion("sass"),
    getLatestStableVersion("sass-loader"),
  ]);

  if (sassVersion) {
    packageJson.devDependencies.sass = `^${sassVersion}`;
  }
  if (sassLoaderVersion) {
    packageJson.devDependencies["sass-loader"] = `^${sassLoaderVersion}`;
  }

  // 写回 package.json
  await writeJson(packageJsonPath, packageJson, { spaces: 2 });
};

const applyEnhancements = async (
  projectName: string,
  enhancements: Enhancement[],
  styleScheme: StyleScheme,
  variant: Variant,
) => {
  for (const enhancement of enhancements) {
    if (enhancement === "Tailwind CSS v4.0") {
      await applyTailwindV4(projectName, styleScheme, variant);
    } else if (enhancement === "Oxfmt") {
      await applyOxfmt(projectName);
    } else if (enhancement === "Oxlint") {
      await applyOxlint(projectName);
    } else if (enhancement === "Pinia (Persisted)") {
      await applyPinia(projectName, variant);
    } else if (enhancement === "Env Config") {
      await applyEnvConfig(projectName, variant);
    } else if (enhancement === "AI Ready") {
      await applyAIReady(projectName, enhancements);
    }
  }
};

const updateAppVueFeatureCards = async (
  projectName: string,
  framework: Framework,
  variant: Variant,
  enhancements: Enhancement[],
) => {
  // 只处理 Vue 项目
  if (framework !== "Vue") {
    return;
  }

  const projectRootPath = `${process.cwd()}/${projectName}`;
  const appVuePath = path.join(projectRootPath, "src", "App.vue");

  try {
    let content = await readFile(appVuePath, "utf-8");

    // 提取现有的 featureCards 数组
    const existingCardsMatch = content.match(/const featureCards = \[([\s\S]*?)\]/);
    if (!existingCardsMatch) {
      return; // 找不到 featureCards，跳过
    }

    // 构建要添加的新卡片数组
    const newCards = [];

    // 根据选择的增强选项添加卡片
    if (enhancements.includes("Tailwind CSS v4.0")) {
      newCards.push({
        icon: "🎨",
        title: "Tailwind CSS v4",
        desc: "原子化 CSS，快速构建现代化 UI",
        bg: "linear-gradient(to bottom right,#ffffff,#faf5ff)",
        titleGradient: "linear-gradient(to right,#9333ea,#2563eb)",
      });
    }

    // 如果是 TypeScript，添加 TypeScript 卡片
    if (variant === "TypeScript") {
      newCards.push({
        icon: "📘",
        title: "TypeScript",
        desc: "完整类型支持，更安全的代码",
        bg: "linear-gradient(to bottom right,#ffffff,#eff6ff)",
        titleGradient: "linear-gradient(to right,#2563eb,#0891b2)",
      });
    }

    // 如果选择了 Oxfmt 或 Oxlint，添加 OXC 卡片
    if (enhancements.includes("Oxfmt") || enhancements.includes("Oxlint")) {
      newCards.push({
        icon: "🦀",
        title: "OXC 支持",
        desc: "基于 Rust 的超高速工具链",
        bg: "linear-gradient(to bottom right,#ffffff,#fff7ed)",
        titleGradient: "linear-gradient(to right,#ea580c,#dc2626)",
      });
    }

    // 如果选择了 Pinia，添加 Pinia 卡片
    if (enhancements.includes("Pinia (Persisted)")) {
      newCards.push({
        icon: "🍍",
        title: "Pinia",
        desc: "Vue 官方推荐的状态管理",
        bg: "linear-gradient(to bottom right,#ffffff,#fefce8)",
        titleGradient: "linear-gradient(to right,#ca8a04,#16a34a)",
      });
    }

    // 如果选择了 AI Ready，添加 AI Ready 卡片
    if (enhancements.includes("AI Ready")) {
      newCards.push({
        icon: "🤖",
        title: "AI Ready",
        desc: "集成 Vue Skills 和 CLAUDE.md",
        bg: "linear-gradient(to bottom right,#ffffff,#f0f9ff)",
        titleGradient: "linear-gradient(to right,#0ea5e9,#8b5cf6)",
      });
    }

    // 如果没有新卡片要添加，直接返回
    if (newCards.length === 0) {
      return;
    }

    // 将新卡片转换为字符串格式
    const newCardsString = newCards.map(card => 
      `  ${JSON.stringify(card, null, 2).replace(/\n/g, '\n  ')}`
    ).join(',\n');

    // 在现有数组的最后一个元素后添加新卡片
    // 匹配最后一个 } 或 }, 后面跟着 ]
    content = content.replace(
      /const featureCards = \[([\s\S]*?)\n\]/,
      (match, existingContent) => {
        // 移除末尾的逗号和空白
        const trimmedContent = existingContent.trimEnd();
        // 添加逗号（如果还没有）和新卡片
        const needsComma = !trimmedContent.endsWith(',');
        return `const featureCards = [${existingContent}${needsComma ? ',' : ''}\n${newCardsString}\n]`;
      }
    );

    await writeFile(appVuePath, content);
  } catch {
    // 文件不存在或修改失败，静默处理
  }
};

const applyTailwindV4 = async (
  projectName: string,
  styleScheme: StyleScheme,
  variant: Variant,
) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 更新 package.json，添加 tailwindcss 和 @tailwindcss/vite
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  const [tailwindVersion, tailwindViteVersion] = await Promise.all([
    getLatestStableVersion("tailwindcss"),
    getLatestStableVersion("@tailwindcss/vite"),
  ]);

  if (tailwindVersion) {
    packageJson.devDependencies.tailwindcss = `^${tailwindVersion}`;
  }
  if (tailwindViteVersion) {
    packageJson.devDependencies["@tailwindcss/vite"] =
      `^${tailwindViteVersion}`;
  }

  await writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // 2. 修改 vite.config.ts/js，添加 tailwindcss() 到 plugins
  await updateViteConfig(projectRootPath, variant);

  // 3. 根据样式方案处理 tailwindcss 导入
  if (styleScheme === "SCSS") {
    await createTailwindCssFile(projectRootPath, variant);
    await addScssPreprocessorConfig(projectRootPath, variant);
  } else {
    await addTailwindImport(projectRootPath, styleScheme);
  }
};

const updateViteConfig = async (projectRootPath: string, variant: Variant) => {
  const ext = variantMap[variant];
  const configFile = path.join(projectRootPath, `vite.config.${ext}`);

  try {
    let content = await readFile(configFile, "utf-8");
    // 检查是否已经有 tailwindcss 导入
    if (!content.includes("tailwindcss")) {
      // 在文件顶部添加导入
      content = content.replace(
        /import\s+{\s*defineConfig\s*}\s+from\s+['"]vite['"]\n/,
        "import { defineConfig } from 'vite'\nimport tailwindcss from '@tailwindcss/vite'\n",
      );
      // 在 plugins 数组中添加 tailwindcss()
      content = content.replace(
        /plugins:\s*\[(.*?)\]/s,
        (_, pluginsContent) => {
          if (pluginsContent.trim()) {
            return `plugins: [tailwindcss(), ${pluginsContent.trim()}]`;
          }
          return `plugins: [tailwindcss()]`;
        },
      );
      await writeFile(configFile, content);
    }
  } catch {
    // 文件不存在或读取失败，静默处理
  }
};

const createTailwindCssFile = async (projectRootPath: string, variant: Variant) => {
  const ext = variantMap[variant];
  const srcPath = path.join(projectRootPath, "src");
  const tailwindCssPath = path.join(srcPath, "tailwind.css");

  // 1. 创建 tailwind.css 文件
  await writeFile(tailwindCssPath, '@import "tailwindcss";\n');

  // 2. 在 main.ts/js 中添加 import "./tailwind.css"
  const mainFile = path.join(projectRootPath, "src", `main.${ext}`);

  try {
    let content = await readFile(mainFile, "utf-8");
    // 检查是否已经导入
    if (!content.includes('import "./tailwind.css"')) {
      // 在文件开头添加 import（在其他 import 之前）
      content = 'import "./tailwind.css"\n' + content;
    }
    await writeFile(mainFile, content);
  } catch {
    // 文件不存在，静默处理
  }
};

const addScssPreprocessorConfig = async (projectRootPath: string, variant: Variant) => {
  const ext = variantMap[variant];
  const configFile = path.join(projectRootPath, `vite.config.${ext}`);

  try {
    let content = await readFile(configFile, "utf-8");
    // 检查是否已经有 css 配置
    if (!content.includes("css:")) {
      const cssConfig = `,
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler'
      }
    }
  }`;
      // 在 plugins 配置之后插入 css 配置
      // 匹配 plugins: [...] 后的逗号或结束位置
      content = content.replace(
        /(plugins:\s*\[[^\]]*\])(\s*,?)/,
        `$1${cssConfig}$2`,
      );
      await writeFile(configFile, content);
    }
  } catch {
    // 文件不存在或读取失败，静默处理
  }
};

const addTailwindImport = async (
  projectRootPath: string,
  styleScheme: StyleScheme,
) => {
  const ext = styleScheme === "SCSS" ? "scss" : "css";
  const styleFiles = [
    path.join(projectRootPath, "src", `style.${ext}`),
    path.join(projectRootPath, `style.${ext}`),
    path.join(projectRootPath, "src", "styles", `style.${ext}`),
  ];

  for (const styleFile of styleFiles) {
    try {
      let content = await readFile(styleFile, "utf-8");
      // 检查是否已经有 tailwindcss 导入
      if (!content.includes('@import "tailwindcss"')) {
        // 在文件顶部添加
        content = '@import "tailwindcss";\n\n' + content;
      }
      await writeFile(styleFile, content);
      break;
    } catch {
      // 文件不存在，继续尝试下一个
    }
  }
};

const applyOxfmt = async (projectName: string) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 更新 package.json，添加 oxfmt 到 devDependencies
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  // 获取 oxfmt 的最新版本
  const oxfmtVersion = await getLatestStableVersion("oxfmt");
  if (oxfmtVersion) {
    packageJson.devDependencies.oxfmt = `^${oxfmtVersion}`;
  }

  // 2. 添加 scripts
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.fmt = "oxfmt";
  packageJson.scripts["fmt:check"] = "oxfmt --check";

  await writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // 3. 在项目根目录创建 .oxfmtrc.jsonc 配置文件
  const oxfmtConfigPath = path.join(projectRootPath, ".oxfmtrc.jsonc");
  const oxfmtConfig = `{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  // Maximum line width
  "printWidth": 80,

  // -------------------------
  // Optional settings
  // -------------------------

  // Spaces per indentation level
  // "tabWidth": 2,

  // Use tabs instead of spaces
  // "useTabs": false,

  // Add semicolons
  // "semi": true,

  // Use single quotes instead of double quotes
  // "singleQuote": false,

  // Trailing commas in multi-line objects/arrays
  // "trailingComma": "all",

  // Files or patterns to ignore
  // "ignorePatterns": [
  //   "dist",
  //   "node_modules"
  // ],

  // Automatically sort imports
  // "sortImports": true,

  // Sort Tailwind CSS classes
  // "sortTailwindcss": true,

  // Sort package.json fields (enabled by default)
  // "sortPackageJson": true
}
`;
  await writeFile(oxfmtConfigPath, oxfmtConfig);

  // 4. 创建 .vscode 目录和配置文件
  const vscodeDir = path.join(projectRootPath, ".vscode");
  await mkdir(vscodeDir, { recursive: true });

  // 创建 extensions.json
  const extensionsJsonPath = path.join(vscodeDir, "extensions.json");
  const extensionsConfig = {
    recommendations: ["oxc.oxc-vscode"],
  };
  await writeJson(extensionsJsonPath, extensionsConfig, { spaces: 2 });

  // 创建 settings.json
  const settingsJsonPath = path.join(vscodeDir, "settings.json");
  const settingsConfig = {
    "oxc.fmt.configPath": ".oxfmtrc.jsonc",
    "editor.defaultFormatter": "oxc.oxc-vscode",
    "editor.formatOnSave": true,
  };
  await writeJson(settingsJsonPath, settingsConfig, { spaces: 2 });
};

const applyOxlint = async (projectName: string) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 更新 package.json，添加 oxlint 到 devDependencies
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (!packageJson.devDependencies) {
    packageJson.devDependencies = {};
  }

  // 获取 oxlint 的最新版本
  const oxlintVersion = await getLatestStableVersion("oxlint");
  if (oxlintVersion) {
    packageJson.devDependencies.oxlint = `^${oxlintVersion}`;
  }

  // 2. 添加 scripts
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  packageJson.scripts.lint = "oxlint";
  packageJson.scripts["lint:fix"] = "oxlint --fix";

  await writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // 3. 在项目根目录创建 .oxlintrc.json 配置文件
  const oxlintConfigPath = path.join(projectRootPath, ".oxlintrc.json");
  const oxlintConfig = {
    $schema: "./node_modules/oxlint/configuration_schema.json",
    categories: {
      correctness: "error",
      suspicious: "warn",
    },
    plugins: ["typescript", "unicorn", "import", "oxc"],
    env: {
      es2022: true,
      browser: true,
      node: true,
    },
    globals: {
      __DEV__: "readonly",
    },
    rules: {
      "import/no-unassigned-import": "off",
      "eslint/no-unused-vars": [
        "error",
        {
          varsIgnorePattern: "^_",
          argsIgnorePattern: "^_",
        },
      ],
      "no-debugger": "error",
      "no-console": "warn",
      "import/no-duplicates": "error",
      "prefer-const": "warn",
      "no-var": "error",
      "typescript/no-explicit-any": "warn",
    },
    overrides: [
      {
        files: ["**/*.test.*", "**/*.spec.*"],
        rules: {
          "no-console": "off",
          "typescript/no-explicit-any": "off",
        },
      },
    ],
    ignorePatterns: [
      "node_modules",
      "dist",
      "build",
      "coverage",
      ".next",
    ],
  };
  await writeJson(oxlintConfigPath, oxlintConfig, { spaces: 2 });
};

const applyPinia = async (projectName: string, variant: Variant) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 更新 package.json，添加 pinia 和 pinia-plugin-persistedstate 到 dependencies
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (!packageJson.dependencies) {
    packageJson.dependencies = {};
  }

  // 获取 pinia 和 pinia-plugin-persistedstate 的最新版本
  const [piniaVersion, persistedstateVersion] = await Promise.all([
    getLatestStableVersion("pinia"),
    getLatestStableVersion("pinia-plugin-persistedstate"),
  ]);

  if (piniaVersion) {
    packageJson.dependencies.pinia = `^${piniaVersion}`;
  }
  if (persistedstateVersion) {
    packageJson.dependencies["pinia-plugin-persistedstate"] =
      `^${persistedstateVersion}`;
  }

  await writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // 2. 在 main.ts/js 中配置 Pinia
  await configurePiniaInMain(projectRootPath, variant);

  // 3. 创建 stores 目录和 counter store
  await createCounterStore(projectRootPath);

  // 4. 修改 HelloWorld.vue 使用 Pinia store
  await updateHelloWorldWithPinia(projectRootPath);
};

const configurePiniaInMain = async (projectRootPath: string, variant: Variant) => {
  const ext = variantMap[variant];
  const mainFile = path.join(projectRootPath, "src", `main.${ext}`);

  try {
    let content = await readFile(mainFile, "utf-8");

    // 添加 Pinia 和持久化插件导入
    if (!content.includes("createPinia")) {
      content = content.replace(
        /import\s+{\s*createApp\s*}\s+from\s+['"]vue['"]/,
        "import { createApp } from 'vue'\nimport { createPinia } from 'pinia'\nimport piniaPluginPersistedstate from 'pinia-plugin-persistedstate'",
      );
    }

    // 添加 createPinia 调用和插件配置
    if (!content.includes("const pinia = createPinia()")) {
      content = content.replace(
        /createApp\(App\)\.mount\(['"]#app['"]\)/,
        "const pinia = createPinia()\npinia.use(piniaPluginPersistedstate)\n\ncreateApp(App).use(pinia).mount('#app')",
      );
    }

    await writeFile(mainFile, content);
  } catch {
    // 文件不存在，静默处理
  }
};

const createCounterStore = async (projectRootPath: string) => {
  const storesDir = path.join(projectRootPath, "src", "stores");
  const counterStorePath = path.join(storesDir, "counter.ts");

  // 确保 stores 目录存在
  await mkdir(storesDir, { recursive: true });

  // 创建 counter store 文件（带持久化配置）
  await writeFile(
    counterStorePath,
    `import { ref } from 'vue'
import { defineStore } from 'pinia'

export const useCounterStore = defineStore(
  'counter',
  () => {
    const count = ref(0)

    function increment() {
      count.value++
    }

    return { count, increment }
  },
  {
    persist: true,
  }
)
`,
  );
};

const updateHelloWorldWithPinia = async (projectRootPath: string) => {
  const helloWorldPath = path.join(
    projectRootPath,
    "src",
    "components",
    "HelloWorld.vue",
  );

  try {
    let content = await readFile(helloWorldPath, "utf-8");

    // 替换 import 语句
    content = content.replace(
      /import\s+{\s*ref\s*}\s+from\s+['"]vue['"]/,
      "import { useCounterStore } from '../stores/counter'",
    );

    // 替换 count 定义
    content = content.replace(
      /const\s+count\s*=\s*ref\(0\)/,
      "const counterStore = useCounterStore()",
    );

    // 替换按钮中的 count（支持多行匹配）
    content = content.replace(
      /<button\s+type="button"\s+@click="count\+\+">\s*count is {{ count }}\s*<\/button>/s,
      '<button type="button" @click="counterStore.increment()">\n        count is {{ counterStore.count }}\n      </button>',
    );

    await writeFile(helloWorldPath, content);
  } catch {
    // 文件不存在或修改失败，静默处理
  }
};

const applyEnvConfig = async (projectName: string, variant: Variant) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;

  // 1. 创建环境变量文件
  const envFiles = [
    { name: ".env", title: "Dev App" },
    { name: ".env.test", title: "Test App" },
    { name: ".env.production", title: "Production App" },
  ];

  for (const envFile of envFiles) {
    const envPath = path.join(projectRootPath, envFile.name);
    const envContent = `# ${envFile.name === ".env" ? "所有环境通用" : envFile.name.replace(".env.", "") + "环境"}\nVITE_APP_TITLE=${envFile.title}\n`;
    await writeFile(envPath, envContent);
  }

  // 2. 更新 vite-env.d.ts 文件（仅 TypeScript 项目）
  if (variant === "TypeScript") {
    const viteEnvPath = path.join(projectRootPath, "src", "vite-env.d.ts");
    try {
      let content = await readFile(viteEnvPath, "utf-8");

      // 检查是否已经有 ImportMetaEnv 定义
      if (!content.includes("interface ImportMetaEnv")) {
        content += `
interface ImportMetaEnv {
  readonly VITE_APP_TITLE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
`;
        await writeFile(viteEnvPath, content);
      }
    } catch {
      // 文件不存在，静默处理
    }
  }

  // 3. 更新 package.json，添加 build scripts
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }

  packageJson.scripts["build:test"] = "vite build --mode test";
  packageJson.scripts["build:prod"] = "vite build --mode production";

  await writeJson(packageJsonPath, packageJson, { spaces: 2 });
};


const applyAIReady = async (projectName: string, enhancements: Enhancement[]) => {
  const projectRootPath = `${process.cwd()}/${projectName}`;
  const spinner = ora("Configuring project enhancements...").start();

  try {
    // 1. 生成 CLAUDE.md 文件
    await generateClaudeMd(projectRootPath, projectName, enhancements);

    // 2. 添加 Vue skills
    await addVueSkills(projectRootPath, enhancements);
    
    spinner.succeed(pc.green("Project enhancements configured successfully"));
  } catch (err) {
    spinner.fail(pc.red("Failed to configure enhancements"));
    consolaInstance.warn(pc.yellow("⚠ You can set up additional features manually later"));
  }
};

const generateClaudeMd = async (
  projectRootPath: string,
  projectName: string,
  enhancements: Enhancement[]
) => {
  // 读取 package.json 获取项目信息
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);

  // 提取项目信息
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const scripts = packageJson.scripts || {};

  // 判断框架和技术栈
  const isVue = dependencies.vue || devDependencies.vue;
  const isReact = dependencies.react || devDependencies.react;
  const isTailwind = enhancements.includes("Tailwind CSS v4.0");
  const isPinia = enhancements.includes("Pinia (Persisted)");
  const isTypeScript = devDependencies.typescript;
  const isOxfmt = enhancements.includes("Oxfmt");
  const isOxlint = enhancements.includes("Oxlint");

  // 构建技术栈列表
  const techStack = [];
  if (isVue) techStack.push("Vue 3");
  if (isReact) techStack.push("React");
  if (isTypeScript) techStack.push("TypeScript");
  else techStack.push("JavaScript");
  techStack.push("Vite");
  if (isTailwind) techStack.push("Tailwind CSS v4");
  if (isPinia) techStack.push("Pinia (with persistence)");
  if (isOxfmt) techStack.push("Oxfmt (Rust-based formatter)");
  if (isOxlint) techStack.push("Oxlint (Rust-based linter)");

  // 生成 CLAUDE.md 内容
  const claudeMdContent = `# ${projectName}

This project was created with [create-peach](https://github.com/zhouxk1204/create-peach), a lightweight CLI tool for scaffolding modern web projects.

## 🎯 Project Overview

A modern web application built with ${techStack.slice(0, 2).join(" and ")}.

## 🛠️ Tech Stack

${techStack.map((tech) => `- ${tech}`).join("\n")}

## 📁 Project Structure

\`\`\`
${projectName}/
├── src/
│   ├── assets/          # Static assets (images, icons, etc.)
│   ├── components/      # Reusable components
${isPinia ? "│   ├── stores/         # Pinia state management stores\n" : ""}${isVue ? "│   ├── App.vue          # Root component\n" : ""}${isReact ? "│   ├── App.jsx/tsx      # Root component\n" : ""}│   └── main.${isTypeScript ? "ts" : "js"}          # Application entry point
├── public/              # Public static files
${isTailwind ? "├── tailwind.css        # Tailwind CSS imports\n" : ""}${isOxfmt ? "├── .oxfmtrc.jsonc      # Oxfmt configuration\n" : ""}${isOxlint ? "├── .oxlintrc.json      # Oxlint configuration\n" : ""}├── index.html           # HTML entry point
├── vite.config.${isTypeScript ? "ts" : "js"}     # Vite configuration
${isTypeScript ? "├── tsconfig.json       # TypeScript configuration\n" : ""}└── package.json         # Project dependencies and scripts
\`\`\`

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm/yarn/pnpm package manager

### Installation

Install dependencies:

\`\`\`bash
npm install
# or
yarn install
# or
pnpm install
\`\`\`

### Development

Start the development server:

\`\`\`bash
npm run dev
\`\`\`

The application will be available at \`http://localhost:5173\`

### Build

Build for production:

\`\`\`bash
npm run build
\`\`\`

### Preview

Preview the production build:

\`\`\`bash
npm run preview
\`\`\`

## 📜 Available Scripts

${Object.entries(scripts)
        .map(([name, command]) => `- \`npm run ${name}\` - ${command}`)
        .join("\n")}

## 🎨 Key Features

${isVue ? "- **Vue 3 Composition API**: Modern reactive framework with script setup syntax\n" : ""}${isReact ? "- **React 18**: Modern React with hooks and functional components\n" : ""}${isTailwind ? "- **Tailwind CSS v4**: Utility-first CSS framework for rapid UI development\n" : ""}${isPinia ? "- **Pinia State Management**: Vue official state management with persistence\n" : ""}${isTypeScript ? "- **TypeScript**: Full type safety and better developer experience\n" : ""}${isOxfmt ? "- **Oxfmt**: Lightning-fast Rust-based code formatter\n" : ""}${isOxlint ? "- **Oxlint**: Ultra-fast Rust-based linter for better code quality\n" : ""}- **Vite**: Next-generation frontend tooling with instant HMR
- **Modern Development**: Hot Module Replacement (HMR) for instant feedback

## 💡 Development Tips

${isVue
        ? `### Vue 3 Best Practices

- Use Composition API with \`<script setup>\` for cleaner code
- Leverage Vue's reactivity system with \`ref\` and \`reactive\`
- Keep components small and focused on a single responsibility
${isPinia ? "- Use Pinia stores for shared state across components\n" : ""}
`
        : ""
      }${isReact
        ? `### React Best Practices

- Use functional components with hooks
- Keep components pure and predictable
- Leverage React's built-in hooks (useState, useEffect, etc.)
- Consider component composition over inheritance

`
        : ""
      }${isTailwind
        ? `### Tailwind CSS

- Use utility classes for rapid prototyping
- Create custom components for repeated patterns
- Leverage Tailwind's responsive design utilities
- Use \`@apply\` directive for complex component styles

`
        : ""
      }${isTypeScript
        ? `### TypeScript

- Define interfaces for component props and data structures
- Use type inference where possible
- Leverage IDE autocomplete for better productivity
- Enable strict mode for maximum type safety

`
        : ""
      }${isOxfmt
        ? `### Code Formatting

Run Oxfmt to format your code:

\`\`\`bash
npm run fmt
\`\`\`

Check formatting without making changes:

\`\`\`bash
npm run fmt:check
\`\`\`

`
        : ""
      }${isOxlint
        ? `### Linting

Run Oxlint to check for issues:

\`\`\`bash
npm run lint
\`\`\`

Auto-fix issues where possible:

\`\`\`bash
npm run lint:fix
\`\`\`

`
        : ""
      }### Vite Configuration

- Vite config is located in \`vite.config.${isTypeScript ? "ts" : "js"}\`
- Add plugins, aliases, and build options as needed
- Vite supports environment variables via \`.env\` files

## 🔗 Useful Resources

${isVue
        ? `- [Vue 3 Documentation](https://vuejs.org/)
- [Vue 3 Composition API](https://vuejs.org/guide/extras/composition-api-faq.html)
`
        : ""
      }${isReact
        ? `- [React Documentation](https://react.dev/)
- [React Hooks](https://react.dev/reference/react)
`
        : ""
      }${isTailwind ? "- [Tailwind CSS Documentation](https://tailwindcss.com/docs)\n" : ""}${isPinia ? "- [Pinia Documentation](https://pinia.vuejs.org/)\n" : ""}${isTypeScript ? "- [TypeScript Documentation](https://www.typescriptlang.org/docs/)\n" : ""}- [Vite Documentation](https://vitejs.dev/)
${isOxfmt ? "- [Oxfmt Documentation](https://oxc.rs/docs/guide/usage/formatter.html)\n" : ""}${isOxlint ? "- [Oxlint Documentation](https://oxc.rs/docs/guide/usage/linter.html)\n" : ""}- [create-peach GitHub](https://github.com/zhouxk1204/create-peach)

## 📝 Notes for Claude

- This is a fresh project scaffold with minimal boilerplate
- Feel free to modify the structure to fit your needs
- All dependencies are modern and actively maintained
- The project follows current best practices for ${isVue ? "Vue" : isReact ? "React" : "web"} development
${isTailwind ? "- Tailwind CSS is configured and ready to use\n" : ""}${isPinia ? "- Pinia stores support persistence out of the box\n" : ""}${isOxfmt || isOxlint ? "- OXC tools provide blazing-fast formatting and linting\n" : ""}- Hot Module Replacement (HMR) is enabled for instant feedback during development

---

Created with ❤️ using [create-peach](https://github.com/zhouxk1204/create-peach)
`;

  // 写入 CLAUDE.md 文件
  const claudeMdPath = path.join(projectRootPath, "CLAUDE.md");
  await writeFile(claudeMdPath, claudeMdContent);
};

const addVueSkills = async (
  projectRootPath: string,
  enhancements: Enhancement[]
) => {
  // 读取 package.json 判断是否是 Vue 项目
  const packageJsonPath = path.join(projectRootPath, "package.json");
  const packageJson = await readJson(packageJsonPath);
  const dependencies = packageJson.dependencies || {};
  const devDependencies = packageJson.devDependencies || {};
  const isVue = dependencies.vue || devDependencies.vue;

  if (!isVue) {
    return; // 不是 Vue 项目，跳过
  }

  // 构建 skills 列表
  const skills = ["vue-best-practices"];
  const isPinia = enhancements.includes("Pinia (Persisted)");
  if (isPinia) {
    skills.push("vue-pinia-best-practices");
  }

  // 执行 npx skills add 命令
  const args = [
    "skills",
    "add",
    "vuejs-ai/skills",
    "--skill",
    ...skills,
    "--agent",
    "claude-code",
    "-y"
  ];
  
  await execa("npx", args, {
    cwd: projectRootPath,
    stdio: "ignore",
  });
};
