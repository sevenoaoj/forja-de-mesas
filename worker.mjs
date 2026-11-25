import {api} from './api.mjs';
import {createMemoryStaticHandler} from './etag.mjs';
import {database} from './storage.mjs';
import assets from './assets.mjs';

const serveAsset = createMemoryStaticHandler(assets);

// The Worker has no SSE room. Share expiring speaking leases across isolates in D1.
const voiceStores=new WeakMap();
function voiceStore(db){
  if(voiceStores.has(db))return voiceStores.get(db);
  let ready;
  function ensure(){
    ready??=db.prepare('CREATE TABLE IF NOT EXISTS token_voice (campaign TEXT, scene TEXT, character TEXT, until_ms INTEGER, PRIMARY KEY(campaign,scene,character), FOREIGN KEY(campaign) REFERENCES campaigns(id) ON DELETE CASCADE)').run().catch(error=>{ready=null;throw error;});
    return ready;
  }
  const voice={
    async write(id,scene,character,until){
      await ensure();
      if(until)await db.prepare('INSERT OR REPLACE INTO token_voice VALUES (?,?,?,?)').bind(id,scene,character,until).run();
      else await db.prepare('DELETE FROM token_voice WHERE campaign=? AND scene=? AND character=?').bind(id,scene,character).run();
    },
    async active(id,scene){
      await ensure();
      const {results}=await db.prepare('SELECT character FROM token_voice WHERE campaign=? AND scene=? AND until_ms>?').bind(id,scene,Date.now()).all();
      return results.map(row=>row.character);
    }
  };
  voiceStores.set(db,voice);return voice;
}

function getStore(env) {
  return database({
    first:(sql,args)=>env.DB.prepare(sql).bind(...args).first(),
    async run(sql,args) {
      const result = await env.DB.prepare(sql).bind(...args).run();
      return result.meta.changes;
    }
  },{
    voice:voiceStore(env.DB),
    async putAsset(key,blob) {
      await env.BUCKET.put(key,await blob.arrayBuffer(),{httpMetadata:{contentType:blob.type}});
    },
    async getAsset(key) {
      return (await env.BUCKET.get(key))?.body;
    },
    deleteAsset:key=>env.BUCKET.delete(key),
    async deleteCampaignAssets(id) {
      let cursor;
      do {const page=await env.BUCKET.list({prefix:id+'/',...(cursor?{cursor}:{})});
        if(page.objects.length)await env.BUCKET.delete(page.objects.map(item=>item.key));
        cursor=page.truncated?page.cursor:null;
      } while(cursor);
    }
  });
}

export default {
  async fetch(request,env) {
    const {pathname} = new URL(request.url);
    if (pathname.startsWith('/api/')) return api(request,getStore(env));
    return serveAsset(request,pathname);
  }
};
