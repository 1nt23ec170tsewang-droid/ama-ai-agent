const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'frontend of ai agent ama', 'src', 'app', 'components');

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const getAuthRegex = /const getAuthenticatedUser = \(\) => \{[\s\S]*?\n\};/m;
const assignRegex1 = /const authenticatedUser = getAuthenticatedUser\(\);/g;
const assignRegex2 = /const \[authenticatedUser\] = useState\(getAuthenticatedUser\(\)\);/g;

const replacementCode = `  const { user } = useAuth();
  const authenticatedUser = {
    id: 'user_123456',
    name: user?.name || 'User',
    firstName: user?.name?.split(' ')[0] || 'User',
    email: user?.email || 'user@example.com',
    initials: (user?.name || 'User').split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2),
    picture: '',
    phone: '+1 (555) 123-4567',
    role: 'Chief Executive Officer',
    company: 'TechCorp Inc.',
    location: 'San Francisco, CA',
    timezone: 'Pacific Time (PT)'
  };`;

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let changed = false;

  if (content.includes('getAuthenticatedUser()') || content.includes('getAuthenticatedUser =')) {
    // 1. Remove the function definition
    content = content.replace(getAuthRegex, '');

    // 2. Add import if needed
    if (!content.includes("import { useAuth }")) {
      // Find the last import and insert after it
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextNewline = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextNewline + 1) + "import { useAuth } from '../context/AuthContext';\n" + content.slice(nextNewline + 1);
      } else {
        content = "import { useAuth } from '../context/AuthContext';\n" + content;
      }
    }

    // 3. Replace assignments
    content = content.replace(assignRegex1, replacementCode);
    content = content.replace(assignRegex2, replacementCode);
    
    // Some files might have `const authenticatedUser = getAuthenticatedUser()` without semicolon
    content = content.replace(/const authenticatedUser = getAuthenticatedUser\(\)/g, replacementCode);

    changed = true;
  }

  if (changed) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${file}`);
  }
});
