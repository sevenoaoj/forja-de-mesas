const campaignId=/^[a-f0-9-]{36}$/;
const tokenPattern=/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
function cookies(request){
 const result=new Map();
 for(const piece of (request.headers.get('Cookie')||'').split(';')){
  const at=piece.indexOf('=');if(at<0)continue;
  result.set(piece.slice(0,at).trim(),piece.slice(at+1).trim());
 }
 return result;
}
export function browserSessionKey(request,id){
 const value=cookies(request).get('forja_access_'+id);
 return tokenPattern.test(value||'')?value:null;
}
export function lastBrowserCampaign(request){
 const id=cookies(request).get('forja_last_campaign');
 return campaignId.test(id||'')?id:null;
}
export function rememberBrowserSession(request,response,id,key){
 if(!campaignId.test(id)||!tokenPattern.test(key))return response;
 const secure=new URL(request.url).protocol==='https:'||request.headers.get('X-Forwarded-Proto')?.split(',')[0].trim()==='https:'||request.headers.get('X-Forwarded-Proto')?.split(',')[0].trim()==='https';
 const flags='; Max-Age=31536000; HttpOnly; SameSite=Lax'+(secure?'; Secure':'');
 response.headers.append('Set-Cookie','forja_access_'+id+'='+key+'; Path=/api/campaigns/'+id+flags);
 response.headers.append('Set-Cookie','forja_last_campaign='+id+'; Path=/api/campaigns'+flags);
 return response;
}
