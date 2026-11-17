// Include snapshots as well as the catalogue: each copy keeps its own portrait.
export function itemPortraits(state){
 const tokens=[...(state.tokens||[]),...(state.sceneLibrary?.scenes||[]).flatMap(scene=>scene.tokens||[])];
 const images=[...(state.inventory||[]).map(item=>item.portrait),...tokens.filter(token=>token.kind==='item').map(token=>token.loot?.item?.portrait)];
 return [...new Map(images.filter(image=>image&&typeof image==='object'&&typeof image.id==='string').map(image=>[image.id,image])).values()];
}
