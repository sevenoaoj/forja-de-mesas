export const narrationFonts={
 literary:{label:'Literária',family:'Georgia, "Times New Roman", serif'},
 elegant:{label:'Elegante',family:'"Instrument Serif", Georgia, serif'},
 modern:{label:'Moderna',family:'"DM Sans", system-ui, sans-serif'},
 typewriter:{label:'Máquina de escrever',family:'"Courier New", monospace'},
 handwritten:{label:'Manuscrita',family:'"Segoe Print", "Comic Sans MS", cursive'}
};
export const narrationPresets={
 candle:{label:'À luz de velas',textColor:'#f5e9d4',backgroundColor:'#1c1522',accentColor:'#e9c982',font:'literary'},
 whisper:{label:'Sussurro arcano',textColor:'#ddf6ef',backgroundColor:'#101f22',accentColor:'#80d8c2',font:'elegant'},
 omen:{label:'Presságio',textColor:'#ffe5e7',backgroundColor:'#25131b',accentColor:'#ff9caa',font:'literary'},
 parchment:{label:'Carta antiga',textColor:'#342619',backgroundColor:'#f1e4c8',accentColor:'#79522e',font:'typewriter'}
};
export const defaultNarrationStyle={...narrationPresets.candle,effect:'typewriter',speed:28,size:24,align:'center'};
delete defaultNarrationStyle.label;
export function narrationContrast(first,second){
 const luminance=color=>{const values=color.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
 const a=luminance(first),b=luminance(second);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
}
export function narrationStyle(value={},strict=false){
 const fail=message=>{throw Object.assign(new Error(message),{status:400});};
 if(!value||typeof value!=='object'||Array.isArray(value)){if(strict)fail('Estilo de mensagem inválido.');value={};}
 const result={};
 const validColor=color=>typeof color==='string'&&/^#[a-f0-9]{6}$/i.test(color);
 for(const key of ['textColor','backgroundColor','accentColor']){
  if(value[key]!==undefined&&!validColor(value[key])){if(strict)fail('Escolha cores válidas para a mensagem.');}
  result[key]=validColor(value[key])?value[key]:defaultNarrationStyle[key];
 }
 for(const [key,choices] of Object.entries({font:Object.keys(narrationFonts),effect:['instant','typewriter'],align:['center','left']})){
  if(value[key]!==undefined&&!choices.includes(value[key])&&strict)fail('Opção de apresentação inválida.');
  result[key]=choices.includes(value[key])?value[key]:defaultNarrationStyle[key];
 }
 for(const [key,min,max] of [['speed',8,80],['size',18,32]]){
  const number=Number(value[key]);
  if(value[key]!==undefined&&(!Number.isInteger(number)||number<min||number>max)&&strict)fail('Use velocidade de 8 a 80 caracteres/s e tamanho de 18 a 32 px.');
  result[key]=Number.isInteger(number)&&number>=min&&number<=max?number:defaultNarrationStyle[key];
 }
 if(strict&&(narrationContrast(result.textColor,result.backgroundColor)<4.5||narrationContrast(result.accentColor,result.backgroundColor)<3))fail('Aumente o contraste entre as cores do texto, destaque e fundo para manter a leitura confortável.');
 return result;
}
