const fs = require('fs');
const path = require('path');

// Regex que detecta emojis (rangos Unicode de emojis)
const EMOJI_REGEX = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F000}-\u{1F02F}]|[\u{1F0A0}-\u{1F0FF}]|[\u{1F100}-\u{1F1FF}]|[\u{1F200}-\u{1F2FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{FE00}-\u{FE0F}]|\u200D/gmu;

// Reemplazos de texto específicos (emoji + texto → solo texto)
const TEXT_REPLACEMENTS = [
  ['✨ Generar con IA', 'Generar con IA'],
  ['✨ Regenerar con IA', 'Regenerar con IA'],
  ['✨ Regenerar con Governex IA', 'Regenerar con Governex IA'],
  ['✨ Generar matriz con Governex IA', 'Generar matriz con Governex IA'],
  ['✨ Generar matriz con IA', 'Generar matriz con IA'],
  ['✨ Generando...', 'Generando...'],
  ['✨ IA', 'IA'],
  ['✨ ', ''],
  ['⏳ Generando...', 'Generando...'],
  ['⏳ ', ''],
  ['💾 Guardar Cambios', 'Guardar Cambios'],
  ['💾 Guardar ficha', 'Guardar ficha'],
  ['💾 Guardar', 'Guardar'],
  ['✏️ Editar / Agregar', 'Editar / Agregar'],
  ['✏️ Editar No Conformidad', 'Editar No Conformidad'],
  ['✏️ Editar Acción Correctiva', 'Editar Acción Correctiva'],
  ['✏️ Editar', 'Editar'],
  ['🚨 No Conformidades', 'No Conformidades'],
  ['🚨 Nueva No Conformidad', 'Nueva No Conformidad'],
  ['🛠️ Acciones Correctivas', 'Acciones Correctivas'],
  ['🛠️ Nueva Acción Correctiva', 'Nueva Acción Correctiva'],
  ['➕ Nuevo Proyecto de Diseño', 'Nuevo Proyecto de Diseño'],
  ['⚙️ Diseño y Desarrollo', 'Diseño y Desarrollo'],
  ['⚙️ Requerimientos para Productos y Servicios', 'Requerimientos para Productos y Servicios'],
  ['📂 Datos generales del área', 'Datos generales del área'],
  ['📚 Cursos / Grados', 'Cursos / Grados'],
  ['📚 Cursos', 'Cursos'],
  ['🎓 Institución Educativa', 'Institución Educativa'],
  ['🎓 Ficha Técnica', 'Ficha Técnica'],
  ['📋 Ficha Técnica', 'Ficha Técnica'],
  ['📋 Fichas Técnicas', 'Fichas Técnicas'],
  ['📊 Vista Matriz', 'Vista Matriz'],
  ['💼 Control de Ventas', 'Control de Ventas'],
  ['👁️ Ver Ficha Técnica', 'Ver Ficha Técnica'],
  ['🎯 Objetivo:', 'Objetivo:'],
  ['💡 Competencias:', 'Competencias:'],
  ['📚 Cursos (', 'Cursos ('],
  ['🔄 Regenerar con IA', 'Regenerar con IA'],
  ['❌ ', ''],
  ['✅ ', ''],
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;

  // Primero aplicar reemplazos de texto específicos
  for (const [from, to] of TEXT_REPLACEMENTS) {
    while (content.includes(from)) {
      content = content.replace(from, to);
    }
  }

  // Luego eliminar todos los emojis restantes
  content = content.replace(EMOJI_REGEX, '');

  // Limpiar espacios dobles que puedan haber quedado en strings de texto
  // Solo en contextos seguros: dentro de > < y comillas simples/dobles de JSX
  content = content.replace(/>\s{2,}</g, '> <');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  return false;
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  let count = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file === 'node_modules' || file === '.git' || file === 'dist') continue;
      count += walkDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      if (processFile(fullPath)) {
        console.log('  Limpiado:', file);
        count++;
      }
    }
  }
  return count;
}

console.log('Eliminando emojis de todos los archivos TSX/TS...\n');
const total = walkDir(path.join('d:\\Governex', 'src'));
console.log(`\nCompletado: ${total} archivos modificados`);
