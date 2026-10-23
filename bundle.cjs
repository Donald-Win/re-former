#!/usr/bin/env node
/**
 * bundle.cjs — Project codebase bundler for AI-assisted development.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * BUNDLE TOOL VERSION: 2.0.1   (with null-byte safety guard)
 * ─────────────────────────────────────────────────────────────────────────────
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// --- CONFIGURATION ---
const ignoreDirs = [
  'node_modules', '.git', '.github', 'dist', 'build', '.next', '.idea',
  '.vscode', 'public/icons', 'coverage', '.cache', '.netlify', '.vercel',
];
const ignoreFiles = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bundle.cjs', '.DS_Store'];
const ignoreExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.pdf', '.zip', '.mp4', '.mov', '.bak', '.log'];

const HOME = os.homedir();
const CACHE_FILE = path.join(HOME, '.bundle-cache.json');

const WIZARDS = {
  pole:                    { component: 'src/wizards/PoleWizard.jsx',                    generators: ['src/wizards/generators/PolePdfGenerator.js'] },
  transformer:             { component: 'src/wizards/TransformerWizard.jsx',             generators: ['src/wizards/generators/TransformerPdfGenerator.js'] },
  elecequip:               { component: 'src/wizards/ElecEquipWizard.jsx',               generators: ['src/wizards/generators/ElecEquipPdfGenerator.js'] },
  lvconnection:            { component: 'src/wizards/LvConnectionWizard.jsx',            generators: ['src/wizards/generators/LvConnectionPdfGenerator.js'] },
  elecdistribution:        { component: 'src/wizards/ElecDistributionWizard.jsx',        generators: ['src/wizards/generators/ElecDistributionPdfGenerator.js'] },
  lvbox:                   { component: 'src/wizards/LvBoxWizard.jsx',                   generators: ['src/wizards/generators/LvBoxPdfGenerator.js'] },
  zonesub:                 { component: 'src/wizards/ZoneSubWizard.jsx',                 generators: ['src/wizards/generators/ZoneSubPdfGenerator.js'] },
  hvinspection:            { component: 'src/wizards/HVInspectionWizard.jsx',            generators: ['src/wizards/generators/HVInspectionPdfGenerator.js', 'src/wizards/generators/HVInspectionChecks.js'] },
  distributiontransformer: { component: 'src/wizards/DistributionTransformerWizard.jsx', generators: ['src/wizards/generators/DistributionTransformerPdfGenerator.js'] },
};

const NEW_WIZARD_EXEMPLAR = 'lvconnection';

const CORE_FILES = [
  'package.json',
  'vite.config.js',
  'netlify.toml',
  'src/main.jsx',
  'src/main.netlify.jsx',
  'src/index.css',
  'src/App.jsx',
  'src/changelog.js',
  'public/forms/README.md',
];

const SHARED_DIR = 'src/shared';

let fileStructureLog = [];      
let textFilesQueue = [];        
let skippedFilesCount = 0;      
const queuedAbsPaths = new Set(); 

function parseArgs(argv) {
  const opts = { targets: [], profile: null, changed: false, sinceRef: null, outDir: null, listProfiles: false, help: false };
  argv.forEach(arg => {
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--list-profiles') opts.listProfiles = true;
    else if (arg === '--changed') opts.changed = true;
    else if (arg.startsWith('--since=')) opts.sinceRef = arg.slice('--since='.length);
    else if (arg.startsWith('--profile=')) opts.profile = arg.slice('--profile='.length);
    else if (arg.startsWith('--out=')) opts.outDir = arg.slice('--out='.length);
    else opts.targets.push(arg);
  });
  return opts;
}

function printHelp() {
  console.log(`
Usage:
  node bundle.cjs [targets...] [options]

Options:
  --profile=<name>      Bundle only a curated subset of files (see --list-profiles)
  --changed              Only include files modified since the last bundle run
  --since=<git-ref>      Only include files changed vs a git ref (e.g. --since=HEAD~3)
  --out=<dir>             Write the output file to <dir> instead of your home directory
  --list-profiles         Show available --profile values and exit
  --help                  Show this help and exit
`);
}

function printProfiles() {
  const wizardNames = Object.keys(WIZARDS).sort().join(', ');
  console.log(`
Available --profile values:
  full            Entire codebase (default). Use for Project Knowledge.
  shared          src/shared/** + root config + App.jsx + changelog.js.
  new-wizard      shared layer + exemplar template.
  wizard:<name>   shared layer + one specific wizard + its generator(s).
  
  Wizards: ${wizardNames}
`);
}

function recordIncluded(relativePath) {
  fileStructureLog.push(`[Included] ${relativePath}`);
  return fileStructureLog.length - 1;
}

const OWN_OUTPUT_PATTERN = /^project-codebase(-[\w.-]+)?\.txt$/;

function queueTextFile(absPath, relativePath) {
  if (queuedAbsPaths.has(absPath)) return;
  const ext = path.extname(absPath).toLowerCase();
  const fileName = path.basename(absPath);
  if (
    ignoreExtensions.includes(ext) ||
    ignoreFiles.includes(fileName) ||
    OWN_OUTPUT_PATTERN.test(fileName) ||
    fileName === '.bundle-cache.json'
  ) {
    skippedFilesCount++;
    return;
  }
  queuedAbsPaths.add(absPath);
  const logIndex = recordIncluded(relativePath);
  textFilesQueue.push({ filePath: absPath, relativePath, logIndex });
}

function queueExplicitFile(relPath) {
  const absPath = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(absPath)) {
    console.warn(`  (profile) Warning: "${relPath}" not found — skipping.`);
    return;
  }
  const stat = fs.statSync(absPath);
  if (!stat.isFile()) return;
  queueTextFile(absPath, relPath);
}

function scanAndQueue(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.error(`Error: Path "${targetPath}" does not exist. Skipping.`);
    return;
  }

  const stat = fs.statSync(targetPath);
  const relativePath = path.relative(process.cwd(), targetPath) || path.basename(targetPath);

  if (stat.isFile()) {
    const absPath = path.resolve(targetPath);
    if (absPath === path.resolve(getOutputFile())) return;
    queueTextFile(absPath, relativePath);
    return;
  }

  if (stat.isDirectory()) {
    const files = fs.readdirSync(targetPath);
    files.forEach(file => {
      const filePath = path.join(targetPath, file);
      const fileStat = fs.statSync(filePath);
      if (fileStat.isDirectory()) {
        if (!ignoreDirs.includes(file)) scanAndQueue(filePath);
      } else {
        scanAndQueue(filePath);
      }
    });
  }
}

function applyProfile(profileArg) {
  if (!profileArg || profileArg === 'full') return false;

  CORE_FILES.forEach(queueExplicitFile);

  if (profileArg === 'shared') {
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  if (profileArg === 'new-wizard') {
    const ex = WIZARDS[NEW_WIZARD_EXEMPLAR];
    queueExplicitFile(ex.component);
    ex.generators.forEach(queueExplicitFile);
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  if (profileArg.startsWith('wizard:')) {
    const key = profileArg.slice('wizard:'.length).toLowerCase();
    const entry = WIZARDS[key];
    if (!entry) {
      console.error(`Unknown wizard "${key}" for --profile=wizard:<name>.`);
      process.exit(1);
    }
    queueExplicitFile(entry.component);
    entry.generators.forEach(queueExplicitFile);
    scanAndQueue(path.resolve(process.cwd(), SHARED_DIR));
    return true;
  }

  console.error(`Unknown profile "${profileArg}".`);
  process.exit(1);
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch { return {}; }
}
function saveCache(cache) {
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(cache)); } catch (e) { console.warn('Could not save bundle cache:', e.message); }
}

function filterByMtimeCache(queue, cache) {
  return queue.filter(({ filePath }) => {
    const abs = path.resolve(filePath);
    let mtime;
    try { mtime = fs.statSync(abs).mtimeMs; } catch { return true; }
    const cached = cache[abs];
    return cached === undefined || mtime > cached;
  });
}

function filterByGitRef(queue, ref) {
  let changedSet;
  try {
    const out = execSync(`git diff --name-only ${ref}`, { cwd: process.cwd(), encoding: 'utf8' });
    changedSet = new Set(out.split('\n').map(s => s.trim()).filter(Boolean).map(p => p.split(path.sep).join('/')));
  } catch (e) {
    console.error(`Could not get "git diff --name-only ${ref}": ${e.message.split('\n')[0]}`);
    return queue;
  }
  return queue.filter(({ relativePath }) => changedSet.has(relativePath.split(path.sep).join('/')));
}

let _resolvedOutputFile = null;
function getOutputFile() { return _resolvedOutputFile; }

function buildOutputFilename(outDir, profileArg, changedFlag, sinceRef) {
  let base = 'project-codebase';
  if (profileArg && profileArg !== 'full') base += '-' + profileArg.replace(':', '-');
  if (changedFlag) base += '-changed';
  if (sinceRef) base += '-since-' + sinceRef.replace(/[^a-zA-Z0-9._-]/g, '');
  return path.join(outDir || HOME, `${base}.txt`);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) { printHelp(); return; }
  if (opts.listProfiles) { printProfiles(); return; }

  _resolvedOutputFile = buildOutputFilename(opts.outDir, opts.profile, opts.changed, opts.sinceRef);

  const usedProfile = applyProfile(opts.profile);

  if (!usedProfile) {
    const targets = opts.targets.length ? opts.targets : ['.'];
    console.log(`Scanning targets: ${targets.join(', ')}...`);
    targets.forEach(scanAndQueue);
  } else if (opts.targets.length) {
    opts.targets.forEach(scanAndQueue);
  }

  let skippedUnchangedCount = 0;
  if (opts.sinceRef || opts.changed) {
    const before = textFilesQueue;
    const kept = opts.sinceRef
      ? filterByGitRef(before, opts.sinceRef)
      : filterByMtimeCache(before, loadCache());

    const keptPaths = new Set(kept.map(f => f.filePath));
    before.forEach(f => {
      if (!keptPaths.has(f.filePath)) {
        fileStructureLog[f.logIndex] = `[Unchanged - skipped] ${f.relativePath}`;
        skippedUnchangedCount++;
      }
    });
    textFilesQueue = kept;
  }

  const outputFile = getOutputFile();
  if (fs.existsSync(outputFile)) fs.unlinkSync(outputFile);
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });

  const modeLabel = [
    opts.profile && opts.profile !== 'full' ? opts.profile : 'full',
    opts.sinceRef ? `since:${opts.sinceRef}` : opts.changed ? 'changed-only' : null,
  ].filter(Boolean).join(' + ');

  fs.writeFileSync(outputFile, `=== PROJECT DIRECTORY MAP ===\n`);
  fs.appendFileSync(outputFile, `Mode: ${modeLabel}\n`);
  const targetsLabel = usedProfile
    ? (opts.targets.length ? `profile scope + ${opts.targets.join(', ')}` : 'profile scope')
    : (opts.targets.length ? opts.targets : ['.']).join(', ');
  fs.appendFileSync(outputFile, `Targets: ${targetsLabel}\n`);
  fs.appendFileSync(outputFile, `Files with full content included below: ${textFilesQueue.length}\n`);
  if (skippedUnchangedCount > 0) {
    fs.appendFileSync(outputFile, `Unchanged (skipped): ${skippedUnchangedCount}\n`);
  }
  fs.appendFileSync(outputFile, `Ignored binaries/locks: ${skippedFilesCount}\n\n`);
  fs.appendFileSync(outputFile, fileStructureLog.join('\n') + `\n\n=========================================\n\n`);

  if (textFilesQueue.length === 0) {
    fs.appendFileSync(outputFile, `(No files matched)\n`);
    console.log('No files to include — nothing changed.');
    console.log(`--> ${outputFile}`);
    return;
  }

  console.log(`Mapped ${fileStructureLog.length} entries (${textFilesQueue.length} with full content). Bundling...`);

  let totalChars = 0;
  const sizes = [];
  const cache = loadCache();

  textFilesQueue.forEach(({ filePath, relativePath }) => {
    try {
      let content = fs.readFileSync(filePath, 'utf8');

      // GUARD: Skip files containing null bytes to prevent Claude upload rejections
      if (content.includes('\0')) {
        console.warn(`  (Warning) Skipping "${relativePath}" — contains null bytes (check file encoding).`);
        skippedFilesCount++;
        return;
      }

      content = content.replace(/\n\s*\n\s*\n/g, '\n\n');

      totalChars += content.length;
      sizes.push({ relativePath, chars: content.length });

      fs.appendFileSync(outputFile, `<file path="${relativePath}">\n${content}\n</file>\n\n`);

      cache[path.resolve(filePath)] = fs.statSync(filePath).mtimeMs;
    } catch (err) {
      console.error(`Failed to read ${relativePath}: ${err.message}`);
    }
  });

  fs.appendFileSync(
    outputFile,
    `=== END OF BUNDLE — ${textFilesQueue.length} files, ${totalChars.toLocaleString()} chars ===\n`,
  );

  saveCache(cache);

  const estTokens = Math.round(totalChars / 4);
  console.log(`\nSuccess! Codebase bundle created.`);
  console.log(`--> ${outputFile}`);
  console.log(`--> Size: ~${(totalChars / 1024).toFixed(1)} KB (~${estTokens.toLocaleString()} tokens).`);
}

main();