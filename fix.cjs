const fs = require('fs');
let code = fs.readFileSync('src/routes/compras.ts', 'utf8');
code = code.replace(/const dummyNit = nit_proveedor \|\| \`PENDIENTE-[^\`]*\`/g, "const dummyNit = nit_proveedor || ('PENDIENTE-' + Date.now())");
fs.writeFileSync('src/routes/compras.ts', code);
