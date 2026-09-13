import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tokenCSS,ranges} from './ui-policy.mjs';
writeFileSync('public/ui-tokens.css',tokenCSS(JSON.parse(readFileSync('public/ui-tokens.json','utf8'))));
// Explicit publication allowlist: never walk the workspace, data, receipts or environment.
const paths=['package.json','server.mjs','test.mjs','readability.test.mjs','agent-policy.test.mjs','AGENTS.md','ADAM-VISUAL-LANGUAGE.md','scripts/build.mjs','scripts/ui-policy.mjs','.github/workflows/agent-ui.yml','.github/workflows/ci.yml','public/index.html','public/board.js','public/style.css','public/design.css','public/mascot.js','public/ui-tokens.json','public/ui-tokens.css','public/contribute.html','public/AGENTS.md','public/CONTRIBUTING.md','public/agent-entry.json','public/visual-language.md','public/privacy.html','public/app.js','public/admin.html','public/admin.js','public/network.json','public/robots.txt','public/llms.txt'];
const files=paths.map(path=>{const content=readFileSync(path,'utf8');return {path,sha256:createHash('sha256').update(content).digest('hex'),content};});
const revision=createHash('sha256').update(JSON.stringify(files)).digest('hex');
writeFileSync('public/source.json',JSON.stringify({format:'adam-source-v1',revision,scope:'Message source; explicit allowlist excludes stored data, credentials, receipts, caches and deployment configuration. Admin UI is public code, never admin data.',files},null,2));
console.log('Validated UI tokens and generated public source revision '+revision);
