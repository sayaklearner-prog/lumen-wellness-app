const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

// Find the project and workspace roots
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo/workspace
config.watchFolders = [workspaceRoot];

// 2. Let Metro resolve packages from the workspace node_modules folder
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// 3. Force Metro to resolve symlinks in pnpm workspaces
config.resolver.disableHierarchicalLookup = false;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

module.exports = config;
