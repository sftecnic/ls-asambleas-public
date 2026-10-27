import type {Store,RecordData,Filter} from '../../worker/store';
export class CalendarStore implements Store{
 values=new Map<string,RecordData>();private chain:Promise<unknown>=Promise.resolve();
 async get(path:string){return structuredClone(this.values.get(path)||null);}
 async getMany(paths:string[]){return Promise.all(paths.map(p=>this.get(p)));}
 async query(collection:string,filters:Filter[]=[],limit=500){return [...this.values.entries()].filter(([path,row])=>path.startsWith(collection+'/')&&filters.every(f=>f.op==='EQUAL'?row[f.field]===f.value:f.op==='GREATER_THAN'?row[f.field]>(f.value as any):f.op==='GREATER_THAN_OR_EQUAL'?row[f.field]>=(f.value as any):row[f.field]<=(f.value as any))).slice(0,limit).map(([,r])=>structuredClone(r));}
 put(path:string,value:RecordData){this.values.set(path,structuredClone(value));}remove(path:string){this.values.delete(path);}
 async atomic<T>(fn:(tx:Store)=>Promise<T>){const work=this.chain.then(async()=>{const tx=new CalendarStore();tx.values=structuredClone(this.values);const result=await fn(tx);this.values=tx.values;return result;});this.chain=work.catch(()=>{});return work;}
}
