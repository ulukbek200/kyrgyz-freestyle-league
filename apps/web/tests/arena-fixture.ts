const weight={id:'w1',name:'74 кг',ageDivision:'U17',kilograms:74};
const athletes=['Айбек','Нурбек','Эрлан','Тимур'].map((firstName,i)=>({id:'a'+i,firstName,lastName:['Токтосунов','Абдырахманов','Сыдыков','Осмонов'][i],city:'Бишкек',country:'Кыргызстан',status:'ACTIVE',dateOfBirth:'2009-04-15',ageDivision:'U17',weightClassId:'w1',weightClass:weight,club:{id:'c1',name:'Клуб вольной борьбы'},imageUrl:'http://127.0.0.1:5187/media/kfl-hero-poster.webp',rankings:[{rank:i+1,points:120-i*10,wins:8,losses:1,seasonId:null,weightClassId:'w1'}],championships:[],_count:{wonMatches:8,matchesAsA:5,matchesAsB:4},matchesAsA:[],matchesAsB:[],tournamentParticipants:[]}));
const event={id:'e1',name:'KFL — Кубок Кыргызстана',startsAt:'2026-11-14T12:00:00Z',city:'Бишкек',venue:'Арена KFL',ageDivision:'U17',status:'PLANNED',description:'Сильнейшие спортсмены встретятся на ковре. Турнир по вольной борьбе.',weightClasses:[{weightClassId:'w1',weightClass:weight}],participants:[],_count:{matches:4,participants:4},bannerUrl:'http://127.0.0.1:5187/media/kfl-hero-poster.webp'};
const matches=[{id:'m1',athleteA:athletes[0],athleteB:athletes[1],weightClass:weight,event,scheduledAt:event.startsAt,status:'COMPLETED',score:{athleteAPoints:8,athleteBPoints:4},winner:athletes[0]}];
const ranks=athletes.map((athlete,i)=>({id:'r'+i,rank:i+1,previousRank:i+2,points:120-i*10,wins:8,losses:1,athlete}));
const posts=[{id:'p1',title:'Новая глава кыргызской борьбы',excerpt:'Истории спортсменов, подготовка к турниру и жизнь лиги за пределами ковра.',category:'ЛИГА',publishedAt:'2026-10-20T12:00:00Z',published:true,imageUrl:'http://127.0.0.1:5187/media/kfl-hero-poster.webp'}];
const champions=[{id:'ch1',athlete:athletes[0],weightClass:weight,wonAt:event.startsAt,isCurrent:true,defenses:2}];
export function arenaResponse(p: string): unknown{
 if(p==='/admin/session')return {role:'ADMIN',email:'preview@example.invalid'};
 if(p==='/admin/dashboard')return {totalAthletes:48,athletes:48,events:6,completed:24,applications:3,upcoming:4,champions:6,matches:28,nextEvents:[event],activity:[]};
 if(p==='/admin/lookups')return {weights:[weight],athletes,clubs:[athletes[0].club],coaches:[],seasons:[],events:[event]};
 if(p==='/age-reference')return {year:2026};
 if(p==='/age-divisions')return [{id:'U17',name:'U17',minAge:16,maxAge:17,weights:[74]},{id:'U23',name:'U23',minAge:18,maxAge:23,weights:[74]}];
 if(p==='/weight-classes')return [weight];
 if(p==='/clubs')return [athletes[0].club];
 if(p==='/summary')return {athletes:48,weightClasses:10};
 if(p==='/rankings')return ranks;
 if(p==='/athletes'||p==='/admin/athletes')return {data:athletes,total:4};
 if(p.startsWith('/athletes/'))return athletes[0];
 if(p==='/events/upcoming'||p==='/events/e1')return event;
 if(p==='/events')return [event];
 if(p==='/matches')return {data:matches,total:1};
 if(p==='/matches/m1')return matches[0];
 if(p==='/champions'||p==='/admin/championships')return champions;
 if(p==='/media'||p==='/admin/media')return posts;
 if(p==='/media/p1')return posts[0];
 if(p==='/admin/ranking-rule')return null;
 return [];
}
