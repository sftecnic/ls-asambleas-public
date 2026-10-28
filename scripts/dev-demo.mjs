// Explicit empty values override local Firebase configuration in Vite.
// This command never connects to production and never changes .env files.
import {spawn} from 'node:child_process';
const child=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{
 stdio:'inherit',env:{...process.env,VITE_FIREBASE_API_KEY:'',VITE_FIREBASE_PROJECT_ID:'',VITE_FIREBASE_APP_ID:''},
});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
