import {api} from './api.mjs';
import {database} from './storage.mjs';
import assets from './assets.mjs';

function getStore(env) {
  return database({
    first:(sql,args)=>env.DB.prepare(sql).bind(...args).first(),
    async run(sql,args) {
      const result = await env.DB.prepare(sql).bind(...args).run();
      return result.meta.changes;
    }
  },{
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
    const file = Object.hasOwn(assets,pathname) && assets[pathname];
    if (!file) return new Response('Página não encontrada.',{status:404});
    const [contentType,base64] = file;
    return new Response(Uint8Array.from(atob(base64),char=>char.charCodeAt(0)),{
      headers:{'Content-Type':contentType,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}
    });
  }
};
