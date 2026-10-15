import {useQuery} from '@tanstack/react-query';
import {Link,Navigate,useParams,useSearchParams} from 'react-router-dom';
import {Pagination,Select,Tabs} from 'antd';
import {ArrowUpRight,MapPin} from 'lucide-react';
import {apiRequest,fullName,type Row} from './pages/admin/api';
import GroupCompetition from './GroupCompetition';
import {mediaUrl} from './mediaUrl';
import './Events.css';

const fallback='/media/kfl-hero-poster.webp';
export const eventLabel=(status:string)=>({PLANNED:'Предстоящий',LIVE:'Идёт сейчас',COMPLETED:'Завершён',CANCELLED:'Отменён'}[status]||status);
const date=(value:string)=>new Date(value).toLocaleString('ru-RU',{dateStyle:'long',timeStyle:'short'});
function Cover({url}:{url?:string}){return <img className="event-cover" src={mediaUrl(url)||fallback} alt="" onError={e=>{if(e.currentTarget.getAttribute('src')!==fallback)e.currentTarget.src=fallback;}}/>;}
function State({query,empty=false}:{query:{isPending:boolean;isError:boolean;refetch:()=>unknown};empty?:boolean}){return query.isPending?<div className="empty-state" role="status">Загрузка…</div>:query.isError?<div className="empty-state" role="alert">Не удалось загрузить данные. <button className="text-link" onClick={()=>void query.refetch()}>Повторить</button></div>:empty?<div className="empty-state">Пока нет данных для выбранных условий.</div>:null;}

export function MatchesRedirect(){const[p]=useSearchParams();return <Navigate replace to={p.get('eventId')?`/events/${encodeURIComponent(p.get('eventId')!)}?tab=schedule`:'/events'+(p.get('status')?'?status='+encodeURIComponent(p.get('status')==='UPCOMING'?'PLANNED':p.get('status')!):'')}/>;}

export function Events(){
 const[p,setP]=useSearchParams(),status=p.get('status')||'';
 const query=useQuery<Row[]>({queryKey:['events'],queryFn:()=>apiRequest('/events','')});
 const events=(query.data||[]).filter(e=>!status||e.status===status).sort((a,b)=>status==='PLANNED'?Date.parse(a.startsAt)-Date.parse(b.startsAt):Date.parse(b.startsAt)-Date.parse(a.startsAt));
 return <div className="page-wrap events-page"><div className="page-intro"><div className="eyebrow">КАЛЕНДАРЬ ЛИГИ</div><h1>СОБЫТИЯ</h1><p>Турниры, расписание и результаты KFL</p></div>
 <div className="event-filters" aria-label="Статус турнира">{[['','Все'],['PLANNED','Предстоящие'],['LIVE','Активные'],['COMPLETED','Завершённые']].map(([value,label])=><button key={value} aria-pressed={status===value} onClick={()=>setP(value?{status:value}:{})}>{label}</button>)}</div>
 <State query={query} empty={!events.length}/><div className="events-grid">{events.map(e=><article className="event-feature" key={e.id} aria-label={e.name}><Link to={'/events/'+e.id}><div className="event-art"><Cover url={e.bannerUrl}/><span className={'event-status status-'+e.status}>{eventLabel(e.status)}</span></div><div className="event-copy"><div className="eyebrow">{e.ageDivision||'KFL'} · {e.weightClasses.length} весовых категорий{e.currentRound?` · Тур ${e.currentRound}`:''}</div><h2>{e.name}</h2><p><MapPin size={16}/>{[e.city,e.venue].filter(Boolean).join(' · ')}</p><time dateTime={e.startsAt}>{date(e.startsAt)}</time><span className="event-open">Открыть турнир <ArrowUpRight size={22}/></span></div></Link></article>)}</div></div>;
}

const tabNames=[['overview','Обзор'],['participants','Участники'],['standings','Группы и турнирные таблицы'],['schedule','Расписание и схватки'],['playoff','Плей-офф'],['results','Результаты']];
export function EventDetail(){
 const{id}=useParams(),[p,setP]=useSearchParams();
 const query=useQuery<Row>({queryKey:['public-event',id],queryFn:()=>apiRequest('/events/'+id,'')}),event=query.data;
 const weights:Row[]=event?.weightClasses||[],weightId=weights.some(w=>w.weightClassId===p.get('weight'))?p.get('weight')!:weights[0]?.weightClassId;
 const tab=tabNames.some(([key])=>key===p.get('tab'))?p.get('tab')!:'overview';
 const update=(key:string,value:string)=>{const next=new URLSearchParams(p);next.set(key,value);next.delete('page');if(weightId)next.set('weight',key==='weight'?value:weightId);setP(next);};
 const participants=(event?.participants||[]).filter((v:Row)=>v.weightClassId===weightId&&v.status==='ACTIVE');
 return <div className="page-wrap events-page"><Link className="text-link" to="/events">← Все события</Link><State query={query}/>{event&&<>
 <header className="event-detail-heading"><span className="eyebrow">{eventLabel(event.status)} · {event.ageDivision||'KFL'}</span><h1>{event.name}</h1><p>{[event.city,event.venue].filter(Boolean).join(' · ')} · {date(event.startsAt)}</p></header>
 <div className="event-category"><label htmlFor="event-weight">Весовая категория</label><Select id="event-weight" aria-label="Категория турнира" value={weightId} onChange={v=>update('weight',v)} options={weights.map(w=>({value:w.weightClassId,label:w.weightClass.name}))}/></div>
 <Tabs className="event-tabs" activeKey={tab} onChange={v=>update('tab',v)} items={tabNames.map(([key,label])=>({key,label}))}/>
 {tab==='overview'&&<section className="event-overview"><Cover url={event.bannerUrl}/><div><h2>О турнире</h2><p className="event-description">{event.description||'Подробности организаторы опубликуют позже.'}</p><dl><dt>Начало</dt><dd>{date(event.startsAt)}</dd><dt>Место проведения</dt><dd>{event.city} · {event.venue}</dd><dt>Категории</dt><dd>{weights.map(w=>w.weightClass.name).join(' · ')||'Не указаны'}</dd></dl><p>Расписание по турам, даты схваток и результаты — в соответствующих вкладках.</p></div></section>}
 {tab==='participants'&&<section><h2>Участники · {participants.length}</h2>{!participants.length?<div className="empty-state">Участники категории ещё не зарегистрированы.</div>:<div className="event-participants">{participants.map((v:Row)=><Link to={'/athletes/'+v.athleteId} key={v.id}><strong>{fullName(v.athlete)}</strong><span>{v.athlete.club?.name||'Без клуба'}</span><ArrowUpRight size={18}/></Link>)}</div>}</section>}
 {(tab==='standings'||tab==='playoff')&&<GroupCompetition event={event} weightId={weightId} view={tab}/>}
 {tab==='schedule'&&<EventSchedule key={id} eventId={id!} weightId={weightId}/>}
 {tab==='results'&&<><GroupCompetition event={event} weightId={weightId} view="winners"/><EventSchedule key={id+'results'} eventId={id!} weightId={weightId} results/></>}
 </>}</div>;
}

function EventSchedule({eventId,weightId,results=false}:{eventId:string;weightId?:string;results?:boolean}){
 const[p,setP]=useSearchParams(),round=p.get('round')||'',group=p.get('group')||'',status=results?'COMPLETED':p.get('matchStatus')||'',page=Math.max(1,Number(p.get('page'))||1);
 const params=new URLSearchParams({eventId,limit:'24',page:String(page),...(weightId?{weightClassId:weightId}:{}),...(status?{status}:{}),...(!results&&round?{round}:{}),...(!results&&group?{group}:{})});
 const query=useQuery<{data:Row[];total:number}>({queryKey:['event-schedule',params.toString()],queryFn:()=>apiRequest('/matches?'+params,'')});
 const change=(key:string,value:string)=>{const next=new URLSearchParams(p);value?next.set(key,value):next.delete(key);if(key!=='page')next.delete('page');setP(next);};
 return <section><h2>{results?'Результаты схваток':'Расписание'}</h2>{!results&&<><p>Туры 1–5 — группы · 6 — 1/8 · 7 — 1/4 · 8 — полуфинал · 9 — финал. Даты назначает организатор.</p><div className="event-filters"><Select aria-label="Тур" value={round} onChange={v=>change('round',v)} options={[{value:'',label:'Все туры'},...Array.from({length:9},(_,i)=>({value:String(i+1),label:'Тур '+(i+1)}))]}/><Select aria-label="Группа" value={group} onChange={v=>change('group',v)} options={[{value:'',label:'Все группы'},...['A','B','C','D'].map(value=>({value,label:'Группа '+value}))]}/><Select aria-label="Статус схватки" value={status} onChange={v=>change('matchStatus',v)} options={[{value:'',label:'Все статусы'},...Object.entries({UPCOMING:'Предстоящие',LIVE:'На ковре',COMPLETED:'Завершённые',CANCELLED:'Отменённые'}).map(([value,label])=>({value,label}))]}/></div></>}
 <State query={query} empty={!query.data?.data.length}/><div className="match-list">{query.data?.data.map(m=><Link className="match-card" to={'/matches/'+m.id} key={m.id}><div className="match-card-meta"><span>{m.weightClass?.name}</span><span>{{UPCOMING:'Скоро',LIVE:'На ковре',COMPLETED:'Завершена',CANCELLED:'Отменена'}[m.status as string]}</span></div><div className="match-card-fighters"><b>{fullName(m.athleteA)}</b><span className="versus">{m.score?`${m.score.athleteAPoints} : ${m.score.athleteBPoints}`:'VS'}</span><b>{fullName(m.athleteB)}</b></div><div className="bout-bottom"><time dateTime={m.scheduledAt}>{date(m.scheduledAt)}</time><ArrowUpRight size={16}/></div></Link>)}</div>
 {(query.data?.total||0)>24&&<Pagination className="public-pagination" current={page} pageSize={24} total={query.data?.total} showSizeChanger={false} onChange={v=>change('page',String(v))}/>}</section>;
}
