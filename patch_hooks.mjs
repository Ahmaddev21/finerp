import fs from 'fs';
import path from 'path';

const hooksDir = path.join(process.cwd(), 'src', 'hooks');

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // 1. Skip if no useState<...>(seed)
  if (!content.match(/useState<.*>\(seed\)/)) {
    return;
  }

  console.log(`Processing ${path.basename(filePath)}...`);

  // 2. Add import if not exists
  if (!content.includes('useAuthStore')) {
    content = content.replace(
      /(import .* from 'react';\n.*)/,
      `$1\nimport { useAuthStore } from '../store/auth';`
    );
  }

  // 3. Replace useState<...>(seed)
  content = content.replace(
    /useState<(.*?)>\(seed\)/g,
    `useState<$1>(isSupabaseConfigured ? [] : seed)`
  );

  // 4. Inject useAuthStore hook call
  // Match `export function useSomething() {`
  if (!content.includes('const { company, isInitialized } = useAuthStore();')) {
    content = content.replace(
      /(export function use[A-Za-z0-9]+\(\) \{)/,
      `$1\n  const { company, isInitialized } = useAuthStore();`
    );
  }

  // 5. Inject company check in fetch
  // Find `if (!isSupabaseConfigured)...` and inject after
  if (!content.includes('if (!company) return;')) {
    content = content.replace(
      /(if \(!isSupabaseConfigured\)[^\n]*return;?\s*\}?)/,
      `$1\n    if (!company) return;`
    );
  }

  // 6. Update useEffect
  content = content.replace(
    /useEffect\(\(\) => \{ fetch\(\); \}, \[fetch\]\);/g,
    `useEffect(() => { if (isInitialized && company) fetch(); }, [fetch, isInitialized, company]);`
  );

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${path.basename(filePath)}`);
  }
}

const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
for (const file of files) {
  processFile(path.join(hooksDir, file));
}
