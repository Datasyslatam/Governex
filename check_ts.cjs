const ts = require('typescript');
const fs = require('fs');

const fileName = 'src/pages/competencias/CompetenciasPage.tsx';
const program = ts.createProgram([fileName], {
  noEmit: true,
  jsx: ts.JsxEmit.React,
  esModuleInterop: true,
  target: ts.ScriptTarget.ES2020,
  moduleResolution: ts.ModuleResolutionKind.NodeJs
});
const emitResult = program.emit();
const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

allDiagnostics.forEach(diagnostic => {
  if (diagnostic.file) {
    if (diagnostic.file.fileName.includes('CompetenciasPage.tsx')) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    }
  }
});
console.log('TS check done.');
