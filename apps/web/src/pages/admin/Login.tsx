import {useState} from 'react';
import {Alert,Button,Form,Input} from 'antd';
import {ArrowUpRight,ShieldCheck} from 'lucide-react';
import {Link} from 'react-router-dom';
import {apiRequest} from './api';
import {required} from './components';

export default function Login({onLogin}:{onLogin:(token:string)=>void}){
  const[busy,setBusy]=useState(false),[error,setError]=useState('');
  return <div className="kfl-login"><div className="kfl-login-story"><Link className="kfl-brand" to="/"><b>KFL<span>®</span></b><small>KYRGYZ FREESTYLE LEAGUE</small></Link><div><span className="kfl-eyebrow">ДЛЯ ТЕХ, КТО СОЗДАЁТ ЛИГУ</span><h1>ЗА КАЖДОЙ<br/>ПОБЕДОЙ —<br/><em>КОМАНДА.</em></h1><p>Спортсмены. Турниры. Результаты.<br/>Вся лига — под вашим управлением.</p></div><span className="kfl-login-edition">CONTROL CENTER <b>03 / 2026</b></span></div><section className="kfl-login-form"><ShieldCheck size={28}/><span className="kfl-eyebrow">ДОСТУП ОРГАНИЗАТОРА</span><h2>Вход в систему</h2><p>Используйте вашу учётную запись команды KFL.</p>{error&&<Alert type="error" showIcon message={error}/>}<Form layout="vertical" onFinish={async v=>{
    if(busy)return;setBusy(true);setError('');try{const data=await apiRequest('/auth/login','',{method:'POST',body:v});if(!['ADMIN','REGISTRAR'].includes(data.user.role)){setError('Для этой учётной записи доступ к панели не разрешён.');return;}onLogin(data.token);}catch(e){setError(e instanceof Error?e.message:'Не удалось войти');}finally{setBusy(false);}
  }}><Form.Item name="email" label="Email" rules={[...required,{type:'email',message:'Проверьте адрес почты'}]}><Input autoComplete="username" placeholder="name@league.kg"/></Form.Item><Form.Item name="password" label="Пароль" rules={required}><Input.Password autoComplete="current-password"/></Form.Item><Button type="primary" htmlType="submit" block loading={busy}>Войти в центр управления <ArrowUpRight size={16}/></Button></Form><Link to="/">← На публичный сайт</Link><small className="kfl-login-security">Защищённый доступ · Kyrgyz Freestyle League</small></section></div>;
}
