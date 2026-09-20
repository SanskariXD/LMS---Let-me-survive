import {solve} from './engine.mjs';self.onmessage=({data})=>{try{self.postMessage(solve(data.courses,data.prefs,500,data.sort))}catch(e){self.postMessage({error:e.message})}};
