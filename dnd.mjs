// SRD 5.2.1 adaptations. Attribution and scope: DND-SRD.md.
export const dndBook='https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf';
export const dndAttribution='This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.';
export const dndAbilities={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'};
export const dndSkills=[['acrobatics','Acrobacia','dex'],['animal-handling','Lidar com Animais','wis'],['arcana','Arcanismo','int'],['athletics','Atletismo','str'],['deception','Enganação','cha'],['history','História','int'],['insight','Intuição','wis'],['intimidation','Intimidação','cha'],['investigation','Investigação','int'],['medicine','Medicina','wis'],['nature','Natureza','int'],['perception','Percepção','wis'],['performance','Atuação','cha'],['persuasion','Persuasão','cha'],['religion','Religião','int'],['sleight-of-hand','Prestidigitação','dex'],['stealth','Furtividade','dex'],['survival','Sobrevivência','wis']];
const skills=(...ids)=>ids;
export const dndClasses=[
 ['barbarian','Bárbaro',12,'str con','',28,[15,13,14,10,12,8],2,skills('animal-handling','athletics','intimidation','nature','perception','survival'),'Fúria, Defesa sem Armadura e Maestria em Armas. Fúria exige as condições e escolhas descritas no livro.'],
 ['bard','Bardo',8,'dex cha','cha',31,[8,14,12,13,10,15],3,dndSkills.map(s=>s[0]),'Inspiração de Bardo (d6) e Conjuração. Escolha suas magias e instrumentos.'],
 ['cleric','Clérigo',8,'wis cha','wis',36,[14,8,13,10,15,12],2,skills('history','insight','medicine','persuasion','religion'),'Conjuração e Ordem Divina. Escolha Protetor ou Taumaturgo no livro.'],
 ['druid','Druida',8,'int wis','wis',41,[8,12,14,13,15,10],2,skills('animal-handling','arcana','insight','medicine','nature','perception','religion','survival'),'Druídico, Conjuração e Ordem Primal. Escolha sua ordem no livro.'],
 ['fighter','Guerreiro',10,'str con','',47,[15,14,13,8,10,12],2,skills('acrobatics','animal-handling','athletics','history','insight','intimidation','persuasion','perception','survival'),'Estilo de Luta, Retomar o Fôlego e Maestria em Armas. Escolha o estilo de luta no livro.'],
 ['monk','Monge',8,'str dex','',49,[12,15,13,10,14,8],2,skills('acrobatics','athletics','history','insight','religion','stealth'),'Artes Marciais (d6) e Defesa sem Armadura. Confira restrições de armadura e armas.'],
 ['paladin','Paladino',10,'wis cha','cha',53,[15,10,13,8,12,14],2,skills('athletics','insight','intimidation','medicine','persuasion','religion'),'Imposição das Mãos, Conjuração e Maestria em Armas. A reserva de cura começa com 5 pontos.'],
 ['ranger','Patrulheiro',10,'str dex','wis',57,[12,15,13,8,14,10],3,skills('animal-handling','athletics','insight','investigation','nature','perception','stealth','survival'),'Conjuração, Inimigo Favorito e Maestria em Armas. Marca do Caçador tem regras próprias de uso.'],
 ['rogue','Ladino',8,'dex int','',62,[12,15,13,14,10,8],4,skills('acrobatics','athletics','deception','insight','intimidation','investigation','perception','persuasion','sleight-of-hand','stealth'),'Especialização, Ataque Furtivo (1d6), Gíria de Ladrões e Maestria em Armas. Escolha duas especializações.'],
 ['sorcerer','Feiticeiro',6,'con cha','cha',65,[10,13,14,8,12,15],2,skills('arcana','deception','insight','intimidation','persuasion','religion'),'Conjuração e Feitiçaria Inata. Registre suas escolhas de magias.'],
 ['warlock','Bruxo',8,'wis cha','cha',70,[8,14,13,12,10,15],2,skills('arcana','deception','history','intimidation','investigation','nature','religion'),'Invocações Místicas e Magia de Pacto. Escolha sua invocação e suas magias.'],
 ['wizard','Mago',6,'int wis','int',77,[8,12,13,15,14,10],2,skills('arcana','history','insight','investigation','medicine','religion'),'Conjuração, Adepto Ritualista e Recuperação Arcana. O grimório inicial contém seis magias de 1º círculo.']
].map(([id,name,hitDie,saves,casting,page,array,count,skills,description])=>({id,name,hitDie,saves:saves.split(' '),casting,page,array,count,skills,description}));
export const dndBackgrounds=[
 {id:'acolyte',name:'Acólito',abilities:['int','wis','cha'],skills:['insight','religion'],feat:'Iniciado em Magia (Clérigo)'},
 {id:'criminal',name:'Criminoso',abilities:['dex','con','int'],skills:['sleight-of-hand','stealth'],feat:'Alerta'},
 {id:'sage',name:'Sábio',abilities:['con','int','wis'],skills:['arcana','history'],feat:'Iniciado em Magia (Mago)'},
 {id:'soldier',name:'Soldado',abilities:['str','dex','con'],skills:['athletics','intimidation'],feat:'Atacante Selvagem'}
];
export const dndSpecies=[['dragonborn','Draconato',30,84,'Escolha ancestralidade dracônica, resistência e formato do sopro.'],['dwarf','Anão',30,84,'Visão no Escuro, resiliência, tenacidade e conhecimento da pedra. A tenacidade acrescenta 1 PV por nível.'],['elf','Elfo',30,84,'Escolha linhagem élfica e uma perícia de Sentidos Aguçados; registre as magias da linhagem.'],['gnome','Gnomo',30,85,'Escolha linhagem da floresta ou das rochas. Astúcia Gnômica modifica certas salvaguardas.'],['goliath','Golias',35,85,'Escolha ancestralidade gigante; confira usos e efeitos no livro.'],['halfling','Halfling',30,86,'Bravura, Agilidade Halfling, Sorte e Furtividade Natural.'],['human','Humano',30,86,'Escolha uma perícia e um talento de Origem adicionais. Recebe Inspiração Heroica após descanso longo.'],['orc','Orc',30,86,'Ímpeto de Adrenalina, Visão no Escuro e Resistência Implacável.'],['tiefling','Tiefling',30,86,'Escolha legado abissal, ctônico ou infernal e registre suas magias.']].map(([id,name,speed,page,description])=>({id,name,speed,page,description}));
export const dndWeapons=[['dagger','Adaga','1d4',false,true,false,89],['quarterstaff','Bordão','1d6',false,false,false,89],['shortbow','Arco curto','1d6',false,false,true,89],['longsword','Espada longa','1d8',true,false,false,89],['greatsword','Espada grande','2d6',true,false,false,89],['rapier','Rapieira','1d8',true,true,false,89],['longbow','Arco longo','1d8',true,false,true,89]].map(([id,name,damage,martial,finesse,ranged,page])=>({id,name,damage,martial,finesse,ranged,page}));
export const dndSpells=[
 ['fire-bolt','Raio de Fogo','Fire Bolt',0,'1d10','attack','sorcerer wizard',107,'Ataque mágico à distância; dano de fogo. O dano aumenta nos níveis 5, 11 e 17.'],
 ['eldritch-blast','Rajada Mística','Eldritch Blast',0,'1d10','attack','warlock',124,'Ataque mágico à distância; dano de energia. Role ataque e dano para cada raio; surgem raios adicionais nos níveis 5, 11 e 17.'],
 ['ray-of-frost','Raio de Gelo','Ray of Frost',0,'1d8','attack','sorcerer wizard',159,'Ataque mágico à distância; dano de frio e redução de deslocamento.'],
 ['sacred-flame','Chama Sagrada','Sacred Flame',0,'1d8','save','cleric',161,'O alvo faz salvaguarda de Destreza contra sua CD; dano radiante.'],
 ['cure-wounds','Curar Ferimentos','Cure Wounds',1,'2d8','heal','bard cleric druid paladin ranger',119,'Cura por toque de 2d8 + modificador de conjuração. Espaços superiores acrescentam 2d8 por círculo.'],
 ['healing-word','Palavra Curativa','Healing Word',1,'2d4','heal','bard cleric druid',140,'Ação bônus para curar 2d4 + modificador de conjuração à distância. Espaços superiores acrescentam 2d4 por círculo.'],
 ['magic-missile','Mísseis Mágicos','Magic Missile',1,'1d4+1','damage','sorcerer wizard',150,'Três projéteis acertam automaticamente. Este botão rola o dano de um projétil; confira a distribuição dos projéteis no livro.'],
 ['guiding-bolt','Raio Guiador','Guiding Bolt',1,'4d6','attack','cleric',138,'Ataque mágico à distância que causa dano radiante e concede vantagem ao próximo ataque contra o alvo até o fim do seu próximo turno.'],
 ['burning-hands','Mãos Flamejantes','Burning Hands',1,'3d6','save','sorcerer wizard',113,'Cone de fogo. Salvaguarda de Destreza, metade do dano em caso de sucesso.'],
 ['thunderwave','Onda Trovejante','Thunderwave',1,'2d8','save','bard druid sorcerer wizard',171,'Cubo de energia trovejante. Salvaguarda de Constituição; confira deslocamento e metade do dano no livro.'],
 ['bless','Bênção','Bless',1,'1d4','effect','cleric paladin',112,'Concentração: acrescenta 1d4 aos ataques e às salvaguardas dos alvos escolhidos.'],
 ['shield','Escudo Arcano','Shield',1,'','utility','sorcerer wizard',163,'Reação: +5 na CA até o começo do seu próximo turno; também protege de Mísseis Mágicos.'],
 ['mage-armor','Armadura Arcana','Mage Armor',1,'','utility','sorcerer wizard',148,'Define a CA base como 13 + Destreza enquanto suas condições forem atendidas; duração de 8 horas.']
].map(([id,name,english,level,formula,kind,classes,page,description])=>({id,name,english,level,formula,kind,classes:classes.split(' '),page,description}));
export const dndRules=[['d20','Testes de d20',6,'Role 1d20, some o modificador do atributo e a proficiência quando aplicável, e compare com a CD ou CA.'],['advantage','Vantagem e desvantagem',7,'Role dois d20 e use o maior com vantagem ou o menor com desvantagem. Se ambas se aplicarem, elas se cancelam.'],['proficiency','Proficiência e especialização',8,'A proficiência varia de +2 a +6 com o nível. Especialização dobra esse bônus quando a regra se aplica.'],['critical','Acerto crítico',16,'Em um acerto crítico, dobre a quantidade de dados de dano do ataque e mantenha os modificadores. O dano deve ser aplicado ao alvo pelo grupo.'],['actions','Ações, ações bônus e reações',9,'O turno inclui movimento e uma ação; ações bônus e reações dependem de regras que as concedam.'],['concentration','Concentração',176,'Você mantém apenas uma concentração por vez. Consulte os gatilhos de interrupção e a salvaguarda de Constituição no glossário.'],['conditions','Condições',176,'O glossário define condições como Agarrado, Amedrontado, Caído, Cego, Enfeitiçado, Envenenado, Impedido, Incapacitado, Inconsciente, Invisível, Paralisado, Petrificado e Surdo.'],['rest','Descansos',185,'Descanso curto e longo têm requisitos e recuperações próprios. Os recursos automáticos da ficha indicam quais são restaurados.']].map(([id,name,page,description])=>({id,name,page,description}));
export function dndFields() {
 const field=(id,label,type,group,initial='')=>({id,label,type,group,initial});
 return [field('dd-level','Nível','number','Identificação','1'),field('dd-species','Espécie','text','Identificação'),field('dd-class','Classe','text','Identificação'),field('dd-background','Antecedente','text','Identificação'),...Object.entries(dndAbilities).map(([id,name])=>field('dd-'+id,name,'number','Atributos','10')),field('dd-prof','Proficiência','number','Combate'),field('dd-ac','Classe de Armadura','number','Combate','10'),field('dd-speed','Deslocamento (pés)','number','Combate','30'),field('dd-dc','CD de magia','number','Combate'),field('dd-spell-attack','Ataque mágico','number','Combate'),field('dd-hp','Pontos de Vida','counter','Recursos'),field('dd-temp','PV temporários','number','Recursos','0'),field('dd-hd','Dados de Vida disponíveis','counter','Recursos','1/1'),field('dd-equipment','Inventário, armadura e moedas','long','Equipamentos'),field('dd-story','História e escolhas de personagem','long','História')];
}
const fail=message=>{throw Object.assign(new Error(message),{status:400});};
export function dndLevel(character){return Math.max(1,Math.min(20,Math.trunc(Number(character.values?.['dd-level'])||1)));}
export function dndModifier(character,id){return Math.floor((Number(character.values?.['dd-'+id]??10)-10)/2);}
export function dndDerived(character,id) {
 if(!character?.dnd)return null;
 const prof=2+Math.floor((dndLevel(character)-1)/4),casting=dndClasses.find(c=>c.id===character.dnd.classId)?.casting||character.dnd.magicAbility;
 if(id==='dd-prof')return String(prof);
 if(id==='dd-dc')return casting?String(8+prof+dndModifier(character,casting)):'—';
 if(id==='dd-spell-attack')return casting?String(prof+dndModifier(character,casting)):'—';
 return null;
}
export function dndCharacter(data) {
 const cls=dndClasses.find(c=>c.id===data.classId),bg=dndBackgrounds.find(b=>b.id===data.backgroundId),species=dndSpecies.find(s=>s.id===data.speciesId);
 if(!cls||!bg||!species)fail('Escolha classe, espécie e antecedente.');
 if(data.weapon&&!dndWeapons.some(w=>w.id===data.weapon))fail('Arma inválida.');
 const scores=Object.fromEntries(Object.keys(dndAbilities).map(id=>[id,Number(data.scores?.[id])]));
 if(Object.values(scores).some(n=>!Number.isInteger(n)||n<3||n>18))fail('Atributos iniciais devem ser inteiros entre 3 e 18.');
 if(data.scoreMethod!=='manual'&&Object.values(scores).sort((a,b)=>a-b).join(',')!=='8,10,12,13,14,15')fail('Distribua os valores 15, 14, 13, 12, 10 e 8 uma vez cada.');
 if(![undefined,'split','three'].includes(data.boostMode))fail('Distribuição de bônus inválida.');
 if(data.boostMode!=='three'&&(!bg.abilities.includes(data.boost2)||!bg.abilities.includes(data.boost1)||data.boost2===data.boost1))fail('Escolha dois atributos distintos permitidos pelo antecedente para +2 e +1.');
 if(data.boostMode==='three')for(const id of bg.abilities)scores[id]++;
 else {scores[data.boost2]+=2;scores[data.boost1]++;}
 const chosen=Array.isArray(data.skills)?[...new Set(data.skills)]:[];
 if(chosen.length!==cls.count||chosen.some(id=>!cls.skills.includes(id)||bg.skills.includes(id)))fail('Escolha '+cls.count+' perícias de classe distintas das perícias do antecedente.');
 const expertise=Array.isArray(data.expertise)?[...new Set(data.expertise)]:[];
 if(cls.id==='rogue'&&(expertise.length!==2||expertise.some(id=>![...chosen,...bg.skills].includes(id))))fail('Ladinos devem escolher duas perícias proficientes para especialização.');
 const values=Object.fromEntries(dndFields().map(f=>[f.id,f.initial]));
 for(const [id,value]of Object.entries(scores))values['dd-'+id]=String(value);
 Object.assign(values,{'dd-class':cls.name,'dd-species':species.name,'dd-background':bg.name,'dd-speed':String(species.speed)});
 const temp={dnd:{classId:cls.id},values};
 const hp=Math.max(1,cls.hitDie+dndModifier(temp,'con')+(species.id==='dwarf'?1:0));values['dd-hp']=hp+'/'+hp;
 values['dd-ac']=String(cls.id==='barbarian'?10+dndModifier(temp,'dex')+dndModifier(temp,'con'):cls.id==='monk'?10+dndModifier(temp,'dex')+dndModifier(temp,'wis'):10+dndModifier(temp,'dex'));
 const layout=dndFields();
 const addResource=(id,label,max,short='none')=>{layout.push({id,label,type:'counter',group:'Recursos',initial:max+'/'+max});values[id]=max+'/'+max;return {id,short};};
 const recovery=[{id:'dd-hp',short:'none'},{id:'dd-hd',short:'none'}];
 if(cls.casting)recovery.push(addResource('dd-slot-1','Espaços de magia · círculo 1',cls.id==='warlock'?1:2,cls.id==='warlock'?'all':'none'));
 if(cls.id==='fighter')recovery.push(addResource('dd-second-wind','Retomar o Fôlego',2,'one'));
 if(cls.id==='barbarian')recovery.push(addResource('dd-rage','Fúrias',2,'one'));
 if(cls.id==='bard')recovery.push(addResource('dd-inspiration','Inspirações de Bardo',Math.max(1,dndModifier(temp,'cha'))));
 if(cls.id==='paladin')recovery.push(addResource('dd-lay-hands','Reserva de Imposição das Mãos',5));
 if(cls.id==='ranger')recovery.push(addResource('dd-hunters-mark','Marca do Caçador · usos sem espaço',2));
 if(cls.id==='sorcerer')recovery.push(addResource('dd-innate','Feitiçaria Inata',2));
 if(cls.id==='wizard')recovery.push(addResource('dd-arcane-recovery','Recuperação Arcana · usos diários',1));
 const rollButtons=Object.entries(dndAbilities).flatMap(([id,name])=>[{id:'dd-check-'+id,name:'Teste de '+name,formula:'1d20+@{dd-'+id+'|mod}'},{id:'dd-save-'+id,name:'Salvaguarda de '+name,formula:'1d20+@{dd-'+id+'|mod}'+(cls.saves.includes(id)?'+@{dd-prof}':'')}]);
 rollButtons.unshift({id:'dd-initiative',name:'Iniciativa',formula:'1d20+@{dd-dex|mod}'+(bg.id==='criminal'?'+@{dd-prof}':'')});
 const skills=dndSkills.map(([id,name,attribute])=>({id,name,attribute:'dd-'+attribute,base:0,bonus:0,other:0,rank:expertise.includes(id)?2:[...chosen,...bg.skills].includes(id)?1:0,favorite:chosen.includes(id)}));
 values['dd-story']=typeof data.choices==='string'?data.choices.trim().slice(0,2000):'';
 const character={preset:'dnd-2024',dnd:{version:'5.2.1',magicAbility:['int','wis','cha'].includes(data.magicAbility)?data.magicAbility:'',classId:cls.id,speciesId:species.id,backgroundId:bg.id,recovery},layout,values,rollButtons,skills,abilities:[{id:'dd-class-feature',name:cls.name+' · nível 1',description:cls.description,sourcePage:cls.page},{id:'dd-species-feature',name:species.name,description:species.description,sourcePage:species.page},{id:'dd-origin-feat',name:bg.feat,description:'Talento de Origem recebido de '+bg.name+'. Consulte o SRD para escolhas, efeitos e restrições.',sourcePage:87}]};
 if(data.weapon)dndAdd(character,'weapon-'+data.weapon);
 return character;
}
export const dndCatalog=[...dndClasses.map(c=>({...c,category:'classes',id:'class-'+c.id})),...dndSpecies.map(s=>({...s,category:'species',id:'species-'+s.id})),...dndBackgrounds.map(b=>({...b,category:'backgrounds',id:'background-'+b.id,page:83,description:'Atributos: '+b.abilities.map(a=>dndAbilities[a]).join(', ')+'. Talento: '+b.feat+'. Perícias: '+b.skills.map(id=>dndSkills.find(s=>s[0]===id)[1]).join(', ')+'.'})),...dndSpells.map(s=>({...s,category:'spells',id:'spell-'+s.id,page:107})),...dndWeapons.map(w=>({...w,category:'weapons',id:'weapon-'+w.id,description:'Dano '+w.damage+'. '+(w.finesse?'Acuidade. ':'')+(w.ranged?'Ataque à distância.':'Arma corpo a corpo.')+' Confira propriedades, versatilidade e maestria no livro.'})),...dndRules.map(r=>({...r,category:'rules',id:'rule-'+r.id}))];
export function dndAdd(character,entryId,options={}) {
 const entry=dndCatalog.find(e=>e.id===entryId);if(!entry)fail('Referência indisponível.');
 const cls=dndClasses.find(c=>c.id===character.dnd?.classId);if(!cls)fail('Use uma ficha D&D.');
 if(entry.category==='spells'&&!entry.classes.includes(cls.id)&&!(character.dnd.backgroundId==='acolyte'&&entry.classes.includes('cleric'))&&!(character.dnd.backgroundId==='sage'&&entry.classes.includes('wizard'))&&!options.allowExtra)fail('Magia de outra classe. Confirme a regra adicional no compêndio.');
 character.abilities??=[];character.rollButtons??=[];
 if(character.abilities.some(a=>a.id===entry.id))return;
 if(character.abilities.length>=60||character.rollButtons.length>=55)fail('Limite de habilidades ou rolagens atingido.');
 character.abilities.push({id:entry.id,name:entry.name,description:entry.description+(options.allowExtra?' Opção adicional confirmada manualmente.':''),sourcePage:entry.page});
 const add=(suffix,name,formula)=>character.rollButtons.push({id:entry.id+'-'+suffix,name,formula});
 if(entry.category==='weapons') {
  const ability=entry.ranged?'dex':entry.finesse&&dndModifier(character,'dex')>dndModifier(character,'str')?'dex':'str';
  const trained=!entry.martial||['barbarian','fighter','paladin','ranger'].includes(cls.id)||cls.id==='rogue'&&entry.finesse;
  add('attack','Ataque · '+entry.name,'1d20+@{dd-'+ability+'|mod}'+(trained?'+@{dd-prof}':''));
  add('damage','Dano · '+entry.name,entry.damage+'+@{dd-'+ability+'|mod}');
 }
 if(entry.category==='spells'&&entry.formula) {
  const casting=cls.casting||character.dnd.magicAbility;
  if(!casting)return;
  if(entry.kind==='attack') {
    add('attack','Ataque mágico · '+entry.name,'1d20+@{dd-spell-attack}');
    character.rollButtons.at(-1).dndSpell={spellId:entry.id,part:'attack'};
  }
  add('effect',(entry.kind==='heal'?'Cura · ':'Dano/efeito · ')+entry.name,dndSpellFormula(character,entry));
  character.rollButtons.at(-1).dndSpell={spellId:entry.id,part:'effect'};
 }
}

export function dndSpellFormula(character,entry,part='effect',slotLevel=entry.level) {
 const casting=dndClasses.find(c=>c.id===character.dnd?.classId)?.casting||character.dnd?.magicAbility;
 if(!casting)fail('Escolha um atributo mágico na criação ou crie uma rolagem personalizada.');
 if(part==='attack')return '1d20+@{dd-spell-attack}';
 let formula=entry.formula;
 if(entry.level===0&&entry.id!=='spell-eldritch-blast')formula=formula.replace(/^1d/,String(1+[5,11,17].filter(level=>dndLevel(character)>=level).length)+'d');
 if(entry.level>0&&slotLevel>entry.level&&['heal','save','attack'].includes(entry.kind))formula=formula.replace(/^(\d+)d/,(_,count)=>String(Number(count)+(slotLevel-entry.level)*(entry.kind==='heal'?2:1))+'d');
 return formula+(entry.kind==='heal'?'+@{dd-'+casting+'|mod}':'');
}
