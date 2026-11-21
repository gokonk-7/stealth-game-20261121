// Night at the Meridian Museum — the hand-in program.
//
// Copies game/ and screenshots/ from this repository into the output
// directory and writes /output/dossier.json with buildDossier from the
// kit's vendor/makefun-game.ts. Outside the grader, MAKEFUN_OUTPUT_DIR
// stands in for /output. Node 22, standard library only.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

// Start from a clean output directory so both runs write identical bytes.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of ['game', 'screenshots']) {
  cpSync(join(repoRoot, name), join(outDir, name), { recursive: true });
}

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);

console.log(`wrote ${outDir}/dossier.json (${dossier.length} bytes)`);
