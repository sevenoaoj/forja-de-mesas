// Public map markers disclose a preview, never the prepared item's secret fields.
export function publicItemToken(token,master=false){
 if(!master&&(token.patrol||token.realName||token.conditionSchedule)){
  const {patrol,realName,conditionSchedule,...visible}=token;
  if(realName&&visible.portrait)visible.portrait={...visible.portrait,name:'Retrato do token'};
  token=visible;
 }
 if(master||token.kind!=='item'||!token.loot)return token;
 const item=token.loot.item||{};
 return {...token,loot:{version:token.loot.version,quantity:token.loot.quantity,item:{name:token.name,kind:item.kind,accent:item.accent,portrait:item.portrait,rarity:item.rarity}}};
}
