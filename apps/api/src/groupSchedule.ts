/** Deterministic circle scheduling. Input order is the administrator's seed order. */
export type GroupPair = {round:number; bout:number; athleteAId:string; athleteBId:string};

export function roundRobin(athleteIds:readonly string[]):GroupPair[]{
  if(athleteIds.length<2||athleteIds.length>64)throw new Error('В группе должно быть от 2 до 64 спортсменов');
  if(athleteIds.some(id=>!id.trim())||new Set(athleteIds).size!==athleteIds.length)throw new Error('Участники группы должны быть уникальными');
  const rotation:Array<string|null>=[...athleteIds];
  if(rotation.length%2)rotation.push(null);
  const pairs:GroupPair[]=[];
  for(let round=1;round<rotation.length;round++){
    let bout=0;
    for(let i=0;i<rotation.length/2;i++){
      const a=rotation[i],b=rotation[rotation.length-1-i];
      if(a!==null&&b!==null)pairs.push({round,bout:++bout,athleteAId:round%2?a:b,athleteBId:round%2?b:a});
    }
    rotation.splice(1,0,rotation.pop()!);
  }
  return pairs;
}

/** Preview only: persistence/confirmation must occur in the tournament transaction. */
export function previewGroups(groups:ReadonlyArray<{name:string;athleteIds:readonly string[]}>){
  if(!groups.length||groups.length>16)throw new Error('Укажите от 1 до 16 групп');
  const names=groups.map(g=>g.name.trim()),ids=groups.flatMap(g=>[...g.athleteIds]);
  if(names.some(n=>!n)||new Set(names).size!==names.length)throw new Error('Названия групп должны быть уникальными');
  if(new Set(ids).size!==ids.length)throw new Error('Один спортсмен выбран несколько раз. В категории турнира спортсмен может занимать только одно место в одной группе. Уберите повторный выбор.');
  return groups.map((g,i)=>({name:names[i],athleteIds:[...g.athleteIds],schedule:roundRobin(g.athleteIds)}));
}
