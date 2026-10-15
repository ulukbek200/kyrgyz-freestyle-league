import {mediaUrl} from '../../mediaUrl';
import {useState} from 'react';
import {Button,Form,Input,Modal,Popconfirm,Select,Switch,Tag} from 'antd';
import {Eye,Image as ImageIcon,Pencil} from 'lucide-react';
import {formatDate,useAdminQuery,useLookups,fullName,type Row} from './api';
import {AddButton,DataState,FormDialog,ImageField,PageTitle,TextField,required} from './components';
import {useEditor} from './Management';
import {useAdminSave} from './useAdminSave';

export default function MediaAdmin(){
  const query=useAdminQuery('media','/admin/media'),lookups=useLookups(),editor=useEditor({published:false}),{save,pending}=useAdminSave(),[preview,setPreview]=useState<Row|null>(null),[filter,setFilter]=useState('all');
  const rows=query.data?.filter(m=>filter==='all'||(filter==='published'?!!m.publishedAt:!m.publishedAt));
  return <><PageTitle title="Медиа" eyebrow="ИСТОРИИ ЛИГИ" description="Публикации, фотографии и люди за пределами ковра." action={<AddButton onClick={()=>editor.show()}>Создать публикацию</AddButton>}/>
    <div className="kfl-filters"><Select aria-label="Состояние публикации" value={filter} onChange={setFilter} options={[{value:'all',label:'Все публикации'},{value:'published',label:'Опубликованные'},{value:'draft',label:'Черновики'}]}/></div>
    <DataState query={query} empty={!rows?.length}><div className="kfl-media-grid">{rows?.map(m=><article className="kfl-media-card" key={m.id}><div className="kfl-media-photo">{m.imageUrl?<img src={mediaUrl(m.imageUrl)} alt={m.title}/>:<ImageIcon size={42}/>}<Tag color={m.publishedAt?'green':'default'}>{m.publishedAt?'Опубликовано':'Черновик'}</Tag></div><div className="kfl-media-copy"><span className="kfl-eyebrow">{m.category}</span><h2>{m.title}</h2><p>{m.excerpt}</p><small>{m.publishedAt?formatDate(m.publishedAt):'Не опубликовано'}</small><footer><Button icon={<Pencil size={14}/>} onClick={()=>editor.show({...m,published:!!m.publishedAt})}>Редактировать</Button><Button aria-label={`Предпросмотр ${m.title}`} icon={<Eye size={15}/>} onClick={()=>setPreview(m)}/><Popconfirm title="Удалить публикацию?" description="Это действие нельзя отменить." okText="Удалить" okButtonProps={{danger:true,loading:pending}} onConfirm={()=>save(`/admin/media/${m.id}`,undefined,'DELETE','Публикация удалена')}><Button danger type="text">Удалить</Button></Popconfirm></footer></div></article>)}</div></DataState>
    <FormDialog {...editor} onClose={editor.close} pending={pending} title={editor.editing?'Редактировать публикацию':'Новая публикация'} onFinish={async values=>{
      const{published,...v}=values;if(await save(`/admin/media${editor.editing?'/'+editor.editing.id:''}`,{...v,athleteId:v.athleteId||null,publishedAt:published?(editor.editing?.publishedAt||new Date().toISOString()):null},editor.editing?'PATCH':'POST'))editor.close();
    }}><TextField name="title" label="Заголовок" wide/><Form.Item name="slug" label="Короткий адрес" rules={[...required,{pattern:/^[a-z0-9-]+$/,message:'Латинские буквы, цифры и дефис'}]}><Input placeholder="history-of-a-champion"/></Form.Item><TextField name="category" label="Рубрика"/>
      <Form.Item name="imageUrl" label="Обложка" className="wide"><ImageField/></Form.Item><Form.Item name="excerpt" label="Текст публикации" className="wide" rules={required}><Input.TextArea rows={5} maxLength={10000} showCount/></Form.Item>
      <Form.Item name="athleteId" label="Спортсмен"><Select allowClear showSearch optionFilterProp="label" options={lookups.data?.athletes.map(a=>({value:a.id,label:fullName(a)}))}/></Form.Item><Form.Item name="published" label="Опубликовать на сайте" valuePropName="checked"><Switch/></Form.Item>
      <Button className="wide" icon={<Eye size={14}/>} onClick={()=>setPreview({id:'preview',...editor.form.getFieldsValue()})}>Предпросмотр</Button>
    </FormDialog><Modal className="kfl-dialog" title="Предпросмотр публикации" open={!!preview} onCancel={()=>setPreview(null)} footer={<Button onClick={()=>setPreview(null)}>Закрыть</Button>} width={700}>{preview&&<article className="kfl-preview">{preview.imageUrl&&<img src={mediaUrl(preview.imageUrl)} alt="Обложка"/>}<Tag>{preview.category||'Рубрика'}</Tag><h2>{preview.title||'Заголовок публикации'}</h2><p>{preview.excerpt||'Текст публикации'}</p></article>}</Modal>
    </>;
}
