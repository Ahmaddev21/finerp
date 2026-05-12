import fs from 'fs';
import path from 'path';

const hooksDir = path.join(process.cwd(), 'src', 'hooks');
const files = fs.readdirSync(hooksDir).filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(hooksDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Remove duplicate selectors
  content = content.replace(/const company = useAuthStore\(s => s\.company\);\n?/g, '');
  content = content.replace(/const isInitialized = useAuthStore\(s => s\.isInitialized\);\n?/g, '');
  content = content.replace(/const \{ company \} = useAuthStore\(\);\n?/g, '');

  // Ensure import exists
  if (!content.includes("import { useAuthStore }")) {
    content = `import { useAuthStore } from '../store/auth';\n` + content;
  }

  fs.writeFileSync(filePath, content, 'utf8');
}
