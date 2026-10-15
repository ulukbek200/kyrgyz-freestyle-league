import {mediaUrl} from './mediaUrl';
import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {ArrowUpRight} from 'lucide-react';
import {apiRequest} from './pages/admin/api';
import './UpcomingEvent.css';

type EventPreview={id:string;name:string;startsAt:string;city:string;venue:string;ageDivision:string|null;bannerUrl:string|null};

const fallback='/media/kfl-hero-poster.webp';
function bannerSource(value:string|null|undefined){
 if(!value)return fallback;
 try{
  if(!/^https?:\/\//i.test(value)&&!/^\/uploads\/[a-f0-9-]+\.(png|jpg|webp)$/.test(value))return fallback;
  return mediaUrl(value)||fallback;
 }catch{return fallback;}
}
export default function UpcomingEvent(){
 const query=useQuery<EventPreview|null>({queryKey:['upcoming-event'],queryFn:()=>apiRequest('/events/upcoming',''),refetchInterval:30000});
 const event=query.data;
 const [failed,setFailed]=useState<string>();
 const source=bannerSource(event?.bannerUrl),image=failed===source?fallback:source;
 return <article className="event-feature event-feature-live" aria-label="Ближайший турнир">
  <img key={image} src={image} alt="" loading="lazy" onError={e=>{if(image!==fallback)setFailed(source);else e.currentTarget.style.display='none';}}/>
  <div className="feature-shade"/>
  <div className="feature-tag"><span className="live-dot"/> СЛЕДУЮЩЕЕ СОБЫТИЕ</div>
  <div className="event-info">
   {event?<>
    <span>{new Date(event.startsAt).toLocaleString('ru-RU',{day:'numeric',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bishkek'})} · {[event.city,event.venue].filter(Boolean).join(' · ')}</span>
    <h3>{event.name}</h3>
    {event.ageDivision&&<p className="event-feature-division">{event.ageDivision}</p>}
    <Link to={`/events/${event.id}`} className="circle-arrow" aria-label={`Подробнее о турнире ${event.name}`}><ArrowUpRight/></Link>
   </>:<>
    <h3>{query.isPending?'Загружаем турнир':query.isError?'Не удалось загрузить турнир':'Турнир скоро появится'}</h3>
    <p>{query.isError?<button type="button" className="text-link" onClick={()=>void query.refetch()}>Повторить загрузку</button>:query.isPending?'':'Следите за анонсами соревнований KFL.'}</p>
   </>}
  </div>
 </article>;
}
