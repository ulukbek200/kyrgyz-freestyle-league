import {useEffect,useState} from 'react';
import './HeroBackground.css';

export default function HeroBackground(){
 const [failed,setFailed]=useState(false);
 const [reduceMotion,setReduceMotion]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
 useEffect(()=>{
  const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
  const update=()=>setReduceMotion(preference.matches);
  preference.addEventListener('change',update);
  return ()=>preference.removeEventListener('change',update);
 },[]);
 return <div className="hero-photo hero-video-background" aria-hidden="true">
  {!failed&&!reduceMotion&&<video src="/media/kfl-hero.mp4" poster="/media/kfl-hero-poster.webp" autoPlay muted loop playsInline preload="metadata" onError={()=>setFailed(true)}/>}
 </div>;
}
