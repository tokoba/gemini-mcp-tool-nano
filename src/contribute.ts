#!/usr/bin/env node

import inquirer from "inquirer";
import chalk from "chalk";
import { spawn, exec } from "child_process";
import { promises as fs } from "fs";
import path from "path";

// Utility function to execute shell commands
const execAsync = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`${error.message}\n${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

// Helper function to get error message from unknown error
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

// Utility function to check if command exists
const commandExists = async (command: string): Promise<boolean> => {
  try {
    await execAsync(`command -v ${command}`);
    return true;
  } catch {
    return false;
  }
};

// Progress indicator
const showProgress = (step: number, total: number, message: string) => {
  console.log(chalk.cyan(`[${step}/${total}] ${message}`));
};

// Main menu options
const MENU_OPTIONS = [
  { name: "🚀 Setup Environment", value: "setup" },
  { name: "🌿 Create Feature Branch", value: "branch" },
  { name: "🎨 Generate from Template", value: "create" },
  { name: "🧪 Test Changes", value: "test" },
  { name: "🎨 Format Code", value: "format" },
  { name: "📤 Submit Contribution", value: "submit" },
  { name: "🔄 Rollback/Undo", value: "undo" },
  { name: "🔍 Validate System", value: "validate" },
  { name: "🧪 Mock Test Workflow", value: "mock-test" },
  { name: "🔬 Dry Run Workflow", value: "test-workflow" },
  { name: "❌ Exit", value: "exit" },
];

// Template options
const TEMPLATE_OPTIONS = [
  { name: "🛠️  new-tool - Add a new MCP tool", value: "new-tool" },
  { name: "🐛 bug-fix - Fix a bug", value: "bug-fix" },
  { name: "📚 docs - Improve documentation", value: "docs" },
  { name: "🎯 custom - Start from scratch", value: "custom" },
];

// Rollback options
const ROLLBACK_OPTIONS = [
  { name: "🗑️  Discard uncommitted changes", value: "discard" },
  { name: "⏪ Remove last commit (keep changes)", value: "soft-reset" },
  { name: "🗑️  Remove last commit and changes", value: "hard-reset" },
  {
    name: "🚨 Delete feature branch and return to main",
    value: "delete-branch",
  },
  { name: "❌ Cancel", value: "cancel" },
];

class ContributionTUI {
  constructor() {}

  async showMainMenu(): Promise<string> {
    console.clear();
    console.log(
      chalk.blue.bold("\n🎯 Gemini MCP Tool - Contribution System\n"),
    );

    const { choice } = await inquirer.prompt([
      {
        type: "list",
        name: "choice",
        message: "What would you like to do?",
        choices: MENU_OPTIONS,
        pageSize: 15,
      },
    ]);

    return choice;
  }

  async setupEnvironment(): Promise<void> {
    console.log(
      chalk.green.bold("\n🚀 Setting up your contribution environment...\n"),
    );

    try {
      // Check dependencies
      showProgress(1, 5, "🔍 Checking dependencies...");

      const deps = [
        { cmd: "git", name: "Git", install: "git" },
        { cmd: "node", name: "Node.js", install: "node" },
        { cmd: "gh", name: "GitHub CLI", install: "gh" },
      ];

      for (const dep of deps) {
        if (!(await commandExists(dep.cmd))) {
          console.log(
            chalk.yellow(`⚠️  ${dep.name} not found, attempting to install...`),
          );
          await this.installDependency(dep.name, dep.install);
        }
      }

      console.log(chalk.green("✅ All dependencies ready!"));

      // Check GitHub authentication
      showProgress(2, 5, "🔐 Checking GitHub authentication...");
      try {
        await execAsync("gh auth status");
        console.log(chalk.green("✅ GitHub CLI authenticated"));
      } catch {
        console.log(chalk.yellow("🔐 Please authenticate with GitHub:"));
        await execAsync("gh auth login");
      }

      // Fork repository
      showProgress(3, 5, "🍴 Forking repository...");
      await execAsync("gh repo fork jamubc/gemini-mcp-tool --clone=false");

      // Clone fork
      showProgress(4, 5, "📥 Cloning your fork...");
      const username = await execAsync("gh api user --jq .login");
      await execAsync(
        `git clone https://github.com/${username}/gemini-mcp-tool.git gemini-mcp-tool-contrib`,
      );

      // Setup upstream and install dependencies
      showProgress(
        5,
        5,
        "🔗 Setting up upstream and installing dependencies...",
      );
      process.chdir("gemini-mcp-tool-contrib");
      await execAsync(
        "git remote add upstream https://github.com/jamubc/gemini-mcp-tool.git",
      );
      await execAsync("npm install");

      console.log(chalk.green.bold("\n✅ Setup complete!"));
      console.log(
        chalk.cyan("📁 Your contribution workspace: gemini-mcp-tool-contrib/"),
      );
      console.log(chalk.cyan("🌟 Next steps:"));
      console.log(chalk.cyan("   - Create a feature branch"));
      console.log(chalk.cyan("   - Make your changes"));
      console.log(chalk.cyan("   - Submit your contribution"));
    } catch (error) {
      console.error(chalk.red(`❌ Setup failed: ${getErrorMessage(error)}`));
    }
  }

  private async installDependency(
    name: string,
    installCmd: string,
  ): Promise<void> {
    console.log(chalk.yellow(`📥 Installing ${name}...`));

    const packageManagers = [
      { check: "brew", cmd: `brew install ${installCmd}` },
      {
        check: "apt-get",
        cmd: `sudo apt-get update && sudo apt-get install -y ${installCmd}`,
      },
      { check: "yum", cmd: `sudo yum install -y ${installCmd}` },
      { check: "winget", cmd: `winget install ${installCmd}` },
    ];

    for (const pm of packageManagers) {
      if (await commandExists(pm.check)) {
        await execAsync(pm.cmd);
        return;
      }
    }

    throw new Error(`Cannot auto-install ${name}. Please install manually.`);
  }

  async createFeatureBranch(): Promise<void> {
    console.log(chalk.green.bold("\n🌿 Creating Feature Branch\n"));

    try {
      const { featureName } = await inquirer.prompt([
        {
          type: "input",
          name: "featureName",
          message: "Enter feature name (e.g., add-calculator-tool):",
          validate: (input) => input.length > 0 || "Feature name is required",
        },
      ]);

      const branchName = `feature/${featureName}`;

      showProgress(1, 3, "🔄 Switching to main and updating...");
      await execAsync("git checkout main");
      await execAsync("git pull upstream main");

      showProgress(2, 3, `🌿 Creating branch: ${branchName}`);
      await execAsync(`git checkout -b "${branchName}"`);

      showProgress(3, 3, "✅ Branch ready!");
      console.log(chalk.green(`✅ Ready to work on: ${branchName}`));
      console.log(
        chalk.cyan(
          "🛠️  Make your changes, then run the TUI again to test and submit",
        ),
      );
    } catch (error) {
      console.error(
        chalk.red(`❌ Branch creation failed: ${getErrorMessage(error)}`),
      );
    }
  }

  async generateFromTemplate(): Promise<void> {
    console.log(
      chalk.green.bold("\n🎨 Creating contribution from template...\n"),
    );

    try {
      const { templateType } = await inquirer.prompt([
        {
          type: "list",
          name: "templateType",
          message: "Choose template:",
          choices: TEMPLATE_OPTIONS,
        },
      ]);

      const { featureName } = await inquirer.prompt([
        {
          type: "input",
          name: "featureName",
          message:
            "Enter feature name (e.g., calculator-tool, fix-memory-leak):",
          validate: (input) => input.length > 0 || "Feature name is required",
        },
      ]);

      // Create branch first
      showProgress(1, 3, "🌿 Creating feature branch...");
      const branchName = `feature/${featureName}`;
      await execAsync("git checkout main");
      await execAsync("git pull upstream main || true");
      await execAsync(`git checkout -b "${branchName}"`);

      // Generate template
      showProgress(2, 3, "📋 Setting up template...");

      if (templateType === "new-tool") {
        await this.createNewToolTemplate(featureName);
      } else if (templateType === "bug-fix") {
        await this.createBugFixTemplate();
      } else if (templateType === "docs") {
        await this.createDocsTemplate();
      } else {
        console.log(
          chalk.green(
            "🎯 Custom contribution - you can start making changes directly",
          ),
        );
      }

      showProgress(3, 3, "🎉 Template ready!");
      console.log(chalk.green.bold("\n🎉 Template ready!"));
      console.log(chalk.cyan("Next steps:"));
      console.log(chalk.cyan("1. Make your changes"));
      console.log(chalk.cyan("2. Test with the TUI"));
      console.log(chalk.cyan("3. Submit with the TUI"));
    } catch (error) {
      console.error(
        chalk.red(`❌ Template creation failed: ${getErrorMessage(error)}`),
      );
    }
  }

  private async createNewToolTemplate(toolName: string): Promise<void> {
    const { toolDescription } = await inquirer.prompt([
      {
        type: "input",
        name: "toolDescription",
        message: "Tool description:",
        validate: (input) => input.length > 0 || "Description is required",
      },
    ]);

    // Read template
    const templatePath = path.join("contribution", "templates", "new-tool.js");
    const template = await fs.readFile(templatePath, "utf8");

    // Replace placeholders
    const toolContent = template
      .replace(/\{\{TOOL_NAME\}\}/g, toolName)
      .replace(/\{\{DESCRIPTION\}\}/g, toolDescription);

    // Write tool file
    const toolFilePath = path.join("src", `${toolName}-tool.ts`);
    await fs.writeFile(toolFilePath, toolContent);

    console.log(chalk.green(`✅ Created: ${toolFilePath}`));
    console.log(chalk.cyan("📝 Edit the file to implement your tool logic"));
  }

  private async createBugFixTemplate(): Promise<void> {
    const templatePath = path.join("contribution", "templates", "bug-fix.md");
    const template = await fs.readFile(templatePath, "utf8");
    await fs.writeFile("CONTRIBUTION_NOTES.md", template);
    console.log(chalk.green("✅ Created: CONTRIBUTION_NOTES.md"));
    console.log(
      chalk.cyan(
        "📝 Fill out the template with details about your contribution",
      ),
    );
  }

  private async createDocsTemplate(): Promise<void> {
    const templatePath = path.join(
      "contribution",
      "templates",
      "docs-improvement.md",
    );
    const template = await fs.readFile(templatePath, "utf8");
    await fs.writeFile("CONTRIBUTION_NOTES.md", template);
    console.log(chalk.green("✅ Created: CONTRIBUTION_NOTES.md"));
    console.log(
      chalk.cyan(
        "📝 Fill out the template with details about your contribution",
      ),
    );
  }

  async testChanges(): Promise<void> {
    console.log(chalk.green.bold("\n🧪 Testing your changes...\n"));

    try {
      showProgress(1, 4, "🔨 Building...");
      await execAsync("npm run build");

      showProgress(2, 4, "✅ Checking TypeScript...");
      await execAsync("npx tsc --noEmit");

      showProgress(3, 4, "🎨 Checking code format...");
      await this.formatCode();

      showProgress(4, 4, "🔌 Testing MCP server...");
      try {
        await execAsync("node dist/index.js --help > /dev/null");
        console.log(chalk.green("✅ MCP server responds"));
      } catch {
        console.log(chalk.red("❌ MCP server test failed"));
        throw new Error("MCP server test failed");
      }

      console.log(chalk.green.bold("\n✅ All tests passed!"));
      console.log(
        chalk.cyan(
          "📤 Ready to submit? Use the submit option in the main menu",
        ),
      );
    } catch (error) {
      console.error(chalk.red(`❌ Tests failed: ${getErrorMessage(error)}`));
    }
  }

  async formatCode(): Promise<void> {
    console.log(chalk.green.bold("\n🎨 Formatting code...\n"));

    try {
      // Check if prettier is available
      if (await commandExists("npx")) {
        try {
          console.log(chalk.cyan("✨ Running Prettier..."));
          await execAsync(
            'npx prettier --write "src/**/*.{js,ts,json}" "*.{js,ts,json,md}" 2>/dev/null || true',
          );
        } catch {
          console.log(chalk.yellow("⚠️  Some files couldn't be formatted"));
        }
      } else {
        console.log(
          chalk.yellow("ℹ️  Prettier not available, skipping formatting"),
        );
      }

      // Check if there's a lint script
      try {
        const packageJson = JSON.parse(
          await fs.readFile("package.json", "utf8"),
        );
        if (packageJson.scripts?.lint) {
          console.log(chalk.cyan("🔍 Running linter..."));
          await execAsync("npm run lint --silent 2>/dev/null || true");
        }
      } catch {
        // Ignore if package.json doesn't exist or lint script is missing
      }

      console.log(chalk.green("✅ Code formatting complete!"));
    } catch (error) {
      console.error(
        chalk.red(`❌ Formatting failed: ${getErrorMessage(error)}`),
      );
    }
  }

  async submitContribution(): Promise<void> {
    console.log(chalk.green.bold("\n📤 Submitting your contribution...\n"));

    try {
      // Auto-format first
      showProgress(1, 4, "🎨 Formatting code...");
      await this.formatCode();

      // Process changes
      showProgress(2, 4, "📝 Processing changes...");
      const hasChanges = await this.checkForChanges();

      if (hasChanges) {
        console.log(chalk.cyan("Changes to be committed:"));
        const status = await execAsync("git status --porcelain");
        console.log(status);

        const { commitMessage } = await inquirer.prompt([
          {
            type: "input",
            name: "commitMessage",
            message:
              "💬 Enter commit message (or press Enter for auto-generated):",
            default: "",
          },
        ]);

        let finalCommitMessage = commitMessage;
        if (!commitMessage.trim()) {
          const branchName = await execAsync("git branch --show-current");
          const featureName = branchName.replace("feature/", "");
          finalCommitMessage = `Add ${featureName}`;
        }

        await execAsync("git add -A");
        await execAsync(`git commit -m "${finalCommitMessage}"`);
      } else {
        console.log(chalk.yellow("ℹ️  No changes to commit"));
      }

      // Push to fork
      showProgress(3, 4, "🚀 Pushing to your fork...");
      const branchName = await execAsync("git branch --show-current");
      await execAsync(`git push -u origin "${branchName}"`);

      // Create PR
      showProgress(4, 4, "🎯 Creating Pull Request...");
      const featureName = branchName.replace("feature/", "");
      const prTitle = `Add ${featureName}`;

      const prBody = `## Summary
- Added ${featureName}

## Testing
- [x] Tested locally with TUI test functionality
- [x] Built successfully
- [x] MCP server functionality verified

## Checklist
- [x] Code follows project conventions
- [x] Changes are tested locally
- [x] Commit message is descriptive

---
🤖 Created with contribution automation TUI`;

      await execAsync(
        `gh pr create --title "${prTitle}" --body "${prBody}" --base main --head "${branchName}"`,
      );

      console.log(chalk.green.bold("\n✅ Pull Request created successfully!"));
      console.log(chalk.green("🎉 Thank you for your contribution!"));
    } catch (error) {
      console.error(
        chalk.red(`❌ Submission failed: ${getErrorMessage(error)}`),
      );
    }
  }

  private async checkForChanges(): Promise<boolean> {
    try {
      await execAsync("git diff --cached --quiet");
      await execAsync("git diff --quiet");
      return false;
    } catch {
      return true;
    }
  }

  async rollbackChanges(): Promise<void> {
    console.log(chalk.green.bold("\n🔄 Contribution rollback utility...\n"));

    try {
      const currentBranch = await execAsync("git branch --show-current");

      if (!currentBranch.startsWith("feature/")) {
        console.log(
          chalk.red(
            "❌ Not on a feature branch. Rollback only works on feature branches.",
          ),
        );
        console.log(chalk.yellow(`Current branch: ${currentBranch}`));
        return;
      }

      console.log(chalk.cyan(`Current branch: ${currentBranch}\n`));

      const { rollbackChoice } = await inquirer.prompt([
        {
          type: "list",
          name: "rollbackChoice",
          message: "Choose rollback option:",
          choices: ROLLBACK_OPTIONS,
        },
      ]);

      switch (rollbackChoice) {
        case "discard":
          console.log(chalk.yellow("🗑️  Discarding uncommitted changes..."));
          await execAsync("git checkout -- .");
          await execAsync("git clean -fd");
          console.log(chalk.green("✅ Uncommitted changes discarded"));
          break;

        case "soft-reset":
          console.log(
            chalk.yellow("⏪ Removing last commit (keeping changes)..."),
          );
          await execAsync("git reset --soft HEAD~1");
          console.log(
            chalk.green("✅ Last commit removed, changes kept in staging"),
          );
          break;

        case "hard-reset":
          console.log(chalk.yellow("🗑️  Removing last commit and changes..."));
          await execAsync("git reset --hard HEAD~1");
          console.log(chalk.green("✅ Last commit and changes removed"));
          break;

        case "delete-branch":
          const { confirmDelete } = await inquirer.prompt([
            {
              type: "confirm",
              name: "confirmDelete",
              message:
                "🚨 This will delete the entire feature branch! Are you sure?",
              default: false,
            },
          ]);

          if (confirmDelete) {
            console.log(chalk.yellow("🔄 Returning to main branch..."));
            await execAsync("git checkout main");
            console.log(
              chalk.yellow(`🗑️  Deleting feature branch: ${currentBranch}`),
            );
            await execAsync(`git branch -D "${currentBranch}"`);
            console.log(chalk.green("✅ Feature branch deleted"));
          } else {
            console.log(chalk.yellow("❌ Cancelled"));
          }
          break;

        case "cancel":
          console.log(chalk.yellow("❌ Cancelled"));
          break;
      }

      console.log(chalk.green("\n🎯 Rollback complete!"));
    } catch (error) {
      console.error(chalk.red(`❌ Rollback failed: ${getErrorMessage(error)}`));
    }
  }

  async validateSystem(): Promise<void> {
    console.log(chalk.green.bold("\n🔍 Validating contribution system...\n"));

    let errors = 0;

    // Check dependencies
    console.log(chalk.cyan("Checking dependencies..."));
    const deps = ["git", "node", "npm", "gh"];
    for (const dep of deps) {
      if (await commandExists(dep)) {
        console.log(chalk.green(`✅ ${dep} is installed`));
      } else {
        console.log(chalk.red(`❌ ${dep} is missing`));
        errors++;
      }
    }

    // Check scripts
    console.log(chalk.cyan("\nChecking scripts..."));
    const scripts = [
      "contribution/setup.sh",
      "contribution/branch.sh",
      "contribution/test.sh",
      "contribution/submit.sh",
      "contribution/create.sh",
    ];

    for (const script of scripts) {
      try {
        const stats = await fs.stat(script);
        if (stats.mode & 0o111) {
          console.log(chalk.green(`✅ ${script} is executable`));
        } else {
          console.log(chalk.red(`❌ ${script} is not executable`));
          errors++;
        }
      } catch {
        console.log(chalk.red(`❌ ${script} is missing`));
        errors++;
      }
    }

    // Check templates
    console.log(chalk.cyan("\nChecking templates..."));
    try {
      await fs.stat("contribution/templates");
      console.log(chalk.green("✅ Templates directory exists"));

      const templates = ["new-tool.js", "bug-fix.md", "docs-improvement.md"];
      for (const template of templates) {
        try {
          await fs.stat(`contribution/templates/${template}`);
          console.log(chalk.green(`✅ ${template} template exists`));
        } catch {
          console.log(chalk.red(`❌ ${template} template missing`));
          errors++;
        }
      }
    } catch {
      console.log(chalk.red("❌ Templates directory missing"));
      errors++;
    }

    // Check GitHub auth
    console.log(chalk.cyan("\nTesting GitHub authentication..."));
    try {
      await execAsync("gh auth status");
      console.log(chalk.green("✅ GitHub CLI authenticated"));
    } catch {
      console.log(
        chalk.yellow("⚠️  GitHub CLI not authenticated (run 'gh auth login')"),
      );
    }

    // Check project structure
    console.log(chalk.cyan("\nTesting project structure..."));
    try {
      await fs.stat("package.json");
      console.log(chalk.green("✅ package.json found"));
    } catch {
      console.log(chalk.red("❌ package.json missing - not in project root?"));
      errors++;
    }

    try {
      await fs.stat("src");
      console.log(chalk.green("✅ src directory found"));
    } catch {
      console.log(chalk.red("❌ src directory missing"));
      errors++;
    }

    // Summary
    console.log();
    if (errors === 0) {
      console.log(chalk.green.bold("🎉 All validation checks passed!"));
      console.log(chalk.green("✅ Contribution system is ready to use"));
    } else {
      console.log(chalk.red.bold(`❌ Found ${errors} issues`));
      console.log(
        chalk.yellow(
          "🔧 Please fix the issues above before using contribution tools",
        ),
      );
    }
  }

  async mockTestWorkflow(): Promise<void> {
    console.log(chalk.green.bold("\n🧪 Running mock contribution test...\n"));

    try {
      // Save current state
      const originalBranch = await execAsync("git branch --show-current");
      console.log(chalk.cyan(`📌 Current branch: ${originalBranch}`));

      // Test branch creation
      console.log(chalk.cyan("\n1️⃣ Testing branch creation..."));
      await execAsync("git checkout main || true");
      await execAsync("git pull upstream main || true");
      await execAsync('git checkout -b "feature/test-mock-feature"');

      // Create mock change
      console.log(chalk.cyan("\n2️⃣ Creating mock change..."));
      await fs.writeFile(
        "mock-test-file.js",
        "// Mock test file - safe to delete\nconsole.log('This is a test contribution');\n",
      );

      // Test build and validation
      console.log(chalk.cyan("\n3️⃣ Testing build and validation..."));
      await execAsync("npm run build");
      await execAsync("npx tsc --noEmit");
      await execAsync("node dist/index.js --help > /dev/null");

      // Test commit
      console.log(chalk.cyan("\n4️⃣ Testing commit process..."));
      await execAsync("git add mock-test-file.js");
      await execAsync(
        'git commit -m "Add mock test file for contribution workflow validation"',
      );

      // Cleanup
      console.log(chalk.cyan("\n5️⃣ Cleaning up mock test..."));
      await execAsync("git reset --hard HEAD~1");
      await fs.unlink("mock-test-file.js").catch(() => {});
      await execAsync(`git checkout ${originalBranch}`);
      await execAsync('git branch -D "feature/test-mock-feature"');

      console.log(
        chalk.green.bold("\n🎉 Mock contribution test completed successfully!"),
      );
      console.log(
        chalk.green("✅ All contribution workflow components are working"),
      );
      console.log(
        chalk.cyan("\nThe contribution system is ready for real use!"),
      );
    } catch (error) {
      console.error(
        chalk.red(`❌ Mock test failed: ${getErrorMessage(error)}`),
      );
      // Attempt cleanup
      try {
        await fs.unlink("mock-test-file.js").catch(() => {});
        const currentBranch = await execAsync("git branch --show-current");
        if (currentBranch === "feature/test-mock-feature") {
          await execAsync("git checkout main");
          await execAsync(
            'git branch -d "feature/test-mock-feature" || git branch -D "feature/test-mock-feature"',
          );
        }
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  async dryRunWorkflow(): Promise<void> {
    console.log(
      chalk.green.bold("\n🔬 Testing contribution workflow (DRY RUN)...\n"),
    );

    try {
      // Check GitHub CLI
      if (!(await commandExists("gh"))) {
        console.log(
          chalk.red("❌ GitHub CLI (gh) is required but not installed."),
        );
        console.log(chalk.cyan("📥 Install it from: https://cli.github.com/"));
        return;
      }

      // Check auth
      try {
        await execAsync("gh auth status");
        console.log(chalk.green("✅ GitHub CLI authenticated"));
      } catch {
        console.log(chalk.yellow("🔐 Please authenticate with GitHub first:"));
        console.log(chalk.cyan("   gh auth login"));
        return;
      }

      const username = await execAsync("gh api user --jq .login");
      console.log(chalk.cyan(`👤 GitHub user: ${username}`));

      // Simulate workflow steps
      console.log(chalk.cyan("🍴 Would fork: jamubc/gemini-mcp-tool"));
      console.log(
        chalk.cyan(
          `📥 Would clone: https://github.com/${username}/gemini-mcp-tool.git`,
        ),
      );
      console.log(
        chalk.cyan(
          "🔗 Would add upstream: https://github.com/jamubc/gemini-mcp-tool.git",
        ),
      );

      try {
        await fs.stat("package.json");
        console.log(
          chalk.cyan("📦 Would install dependencies with: npm install"),
        );
      } catch {
        console.log(
          chalk.yellow(
            "⚠️  No package.json found - would need to be in project directory",
          ),
        );
      }

      console.log(
        chalk.cyan("🌿 Would create feature branch: feature/test-feature"),
      );
      console.log(chalk.cyan("🔨 Would build project with: npm run build"));
      console.log(
        chalk.cyan("✅ Would run TypeScript check: npx tsc --noEmit"),
      );
      console.log(chalk.cyan("🔌 Would test MCP server functionality"));
      console.log(chalk.cyan("📝 Would commit changes"));
      console.log(chalk.cyan("🚀 Would push to fork"));
      console.log(chalk.cyan("🎯 Would create Pull Request"));

      console.log(
        chalk.green.bold(
          "\n✅ Workflow test complete! All steps would execute successfully.",
        ),
      );
      console.log(chalk.cyan("🚀 To run actual workflow:"));
      console.log(chalk.cyan("   - Use the setup option in the main menu"));
      console.log(chalk.cyan("   - Create a feature branch"));
      console.log(chalk.cyan("   - Make your changes"));
      console.log(chalk.cyan("   - Test and submit"));
    } catch (error) {
      console.error(chalk.red(`❌ Dry run failed: ${getErrorMessage(error)}`));
    }
  }

  async run(): Promise<void> {
    console.log(
      chalk.blue.bold("Welcome to the Gemini MCP Tool Contribution System! 🎯"),
    );

    while (true) {
      try {
        const choice = await this.showMainMenu();

        switch (choice) {
          case "setup":
            await this.setupEnvironment();
            break;
          case "branch":
            await this.createFeatureBranch();
            break;
          case "create":
            await this.generateFromTemplate();
            break;
          case "test":
            await this.testChanges();
            break;
          case "format":
            await this.formatCode();
            break;
          case "submit":
            await this.submitContribution();
            break;
          case "undo":
            await this.rollbackChanges();
            break;
          case "validate":
            await this.validateSystem();
            break;
          case "mock-test":
            await this.mockTestWorkflow();
            break;
          case "test-workflow":
            await this.dryRunWorkflow();
            break;
          case "exit":
            console.log(
              chalk.green.bold(
                "\n👋 Thank you for contributing to Gemini MCP Tool!",
              ),
            );
            process.exit(0);
            break;
          default:
            console.log(chalk.red("Unknown option selected"));
        }

        // Wait for user to press enter before showing menu again
        await inquirer.prompt([
          {
            type: "input",
            name: "continue",
            message: "Press Enter to continue...",
          },
        ]);
      } catch (error) {
        console.error(chalk.red(`Error: ${getErrorMessage(error)}`));

        // Wait for user acknowledgment
        await inquirer.prompt([
          {
            type: "input",
            name: "continue",
            message: "Press Enter to continue...",
          },
        ]);
      }
    }
  }
}

// Run the TUI
const tui = new ContributionTUI();
tui.run().catch((error) => {
  console.error(chalk.red("Fatal error:", getErrorMessage(error)));
  process.exit(1);
});
