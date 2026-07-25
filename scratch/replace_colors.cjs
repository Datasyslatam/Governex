const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

const replacements = [
  { pattern: /#1[aA]6[eE][bB][dD]/g, replacement: '#030097' }, 
  { pattern: /#1[bB]3[aA]6[bB]/g, replacement: '#030097' }, 
  { pattern: /#162[fF]58/g, replacement: '#5E4AAC' }, 
  { pattern: /#2[eE]86[dD][eE]/g, replacement: '#FE7F03' }, 
  { pattern: /#[eE]08[aA]00/g, replacement: '#FE7F03' }, 
  { pattern: /#1a3361/gi, replacement: '#02007a' },
  { pattern: /#162850/gi, replacement: '#010052' },
];

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk(srcDir);
let changedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  
  replacements.forEach(({ pattern, replacement }) => {
    newContent = newContent.replace(pattern, replacement);
  });
  
  if (newContent !== content) {
    fs.writeFileSync(file, newContent, 'utf8');
    changedCount++;
  }
});

console.log(`Replaced colors in ${changedCount} files.`);
