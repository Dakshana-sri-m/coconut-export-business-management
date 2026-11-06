// sync_github.js - Direct Git Data API synchronization with GitHub
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

function getToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const tokenFile = path.join(__dirname, 'github_token.txt');
  if (fs.existsSync(tokenFile)) {
    return fs.readFileSync(tokenFile, 'utf-8').trim();
  }
  throw new Error('GitHub token not found. Please set GITHUB_TOKEN or create github_token.txt');
}

const TOKEN = getToken();
const OWNER = 'Dakshana-sri-m';
const REPO = 'coconut-export-business-management';

const HEADERS = {
  'Authorization': `token ${TOKEN}`,
  'User-Agent': 'CoconutExport-GitSync',
  'Accept': 'application/vnd.github.v3+json',
  'Content-Type': 'application/json'
};

async function api(endpoint, method = 'GET', body = null) {
  const url = endpoint.startsWith('https://') ? endpoint : `https://api.github.com${endpoint}`;
  const opts = { method, headers: HEADERS };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(`API ${method} ${endpoint} returned ${res.status}: ${data.message || text}`);
    }
    return data;
  } catch (err) {
    if (!res.ok) throw new Error(`API ${method} ${endpoint} returned ${res.status}: ${text}`);
    return text;
  }
}

async function ensureRepo() {
  console.log(`Checking if repository ${OWNER}/${REPO} exists...`);
  try {
    const repo = await api(`/repos/${OWNER}/${REPO}`);
    console.log(`Repository exists: ${repo.html_url}`);
    return repo;
  } catch (e) {
    console.log(`Repository does not exist. Creating new public repository ${REPO}...`);
    const newRepo = await api('/user/repos', 'POST', {
      name: REPO,
      description: 'Digital Management System for Coconut Export Business based on 16 pages of digitized notebook records, TallyPrime export invoicing, farmer procurement, piece-rate de-husking labor, and fleet logistics.',
      private: false,
      auto_init: false
    });
    console.log(`Successfully created repository: ${newRepo.html_url}`);
    return newRepo;
  }
}

function getFilesToSync(dir, baseDir = dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const item of list) {
    if (item === '.git' || item === 'node_modules' || item === 'github_token.txt' || item === '.env') continue;
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesToSync(fullPath, baseDir));
    } else {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      if (!relPath.endsWith('.log') && !relPath.endsWith('.tmp') && !relPath.includes('.db-journal') && !relPath.endsWith('.token')) {
        results.push({ relPath, fullPath, stat });
      }
    }
  }
  return results;
}

async function ensureInitialized() {
  try {
    await api(`/repos/${OWNER}/${REPO}/git/ref/heads/main`);
    console.log('Repository is already initialized with main branch.');
  } catch {
    console.log('Repository is empty. Initializing repository with README via Contents API...');
    const readmeContent = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8');
    await api(`/repos/${OWNER}/${REPO}/contents/README.md`, 'PUT', {
      message: 'Initial repository setup',
      content: Buffer.from(readmeContent).toString('base64')
    });
    console.log('Repository initialized successfully.');
  }
}

async function pushFiles() {
  await ensureRepo();
  await ensureInitialized();

  console.log('\nScanning files to upload...');
  const files = getFilesToSync(path.join(__dirname));
  console.log(`Found ${files.length} project files to sync.`);

  // 1. Create blobs
  console.log('Creating Git blobs on GitHub...');
  const treeItems = [];
  for (const f of files) {
    const contentBuffer = fs.readFileSync(f.fullPath);
    const isBinary = contentBuffer.includes(0); // binary file check
    const encoding = isBinary ? 'base64' : 'utf-8';
    const content = isBinary ? contentBuffer.toString('base64') : contentBuffer.toString('utf-8');

    const blob = await api(`/repos/${OWNER}/${REPO}/git/blobs`, 'POST', {
      content,
      encoding
    });

    treeItems.push({
      path: f.relPath,
      mode: '100644',
      type: 'blob',
      sha: blob.sha
    });
    console.log(`  ✓ Uploaded: ${f.relPath}`);
  }

  // 2. Create Tree
  console.log('Creating Git tree...');
  const tree = await api(`/repos/${OWNER}/${REPO}/git/trees`, 'POST', {
    tree: treeItems
  });
  console.log(`Tree created: ${tree.sha}`);

  // 3. Get Parent commit (if branch exists)
  let parentSha = null;
  try {
    const ref = await api(`/repos/${OWNER}/${REPO}/git/ref/heads/main`);
    parentSha = ref.object.sha;
    console.log(`Current main branch head commit: ${parentSha}`);
  } catch {
    console.log('No existing head commit found on main.');
  }

  // 4. Create Commit
  const commitMsg = process.argv[2] || `Update Coconut Export Management System - ${new Date().toLocaleString()}`;
  console.log(`Creating Git commit with message: "${commitMsg}"...`);
  const commitPayload = {
    message: commitMsg,
    tree: tree.sha,
    author: {
      name: 'Dakshana Sri M',
      email: 'dakshanasrim1406@gmail.com'
    }
  };
  if (parentSha) {
    commitPayload.parents = [parentSha];
  }

  const commit = await api(`/repos/${OWNER}/${REPO}/git/commits`, 'POST', commitPayload);
  console.log(`Commit created: ${commit.sha}`);

  // 5. Update Ref
  if (parentSha) {
    console.log('Updating refs/heads/main...');
    await api(`/repos/${OWNER}/${REPO}/git/refs/heads/main`, 'PATCH', {
      sha: commit.sha,
      force: true
    });
  } else {
    console.log('Creating refs/heads/main reference...');
    await api(`/repos/${OWNER}/${REPO}/git/refs`, 'POST', {
      ref: 'refs/heads/main',
      sha: commit.sha
    });
  }

  console.log(`\n============================================================`);
  console.log(`SUCCESSFULLY PUSHED ALL CODE TO GITHUB!`);
  console.log(`Repository URL: https://github.com/${OWNER}/${REPO}`);
  console.log(`============================================================\n`);
}

pushFiles().catch(err => {
  console.error('\nERROR syncing to GitHub:', err.message);
  process.exit(1);
});
