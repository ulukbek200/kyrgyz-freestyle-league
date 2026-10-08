import { FormSelect as Select } from '../../components/FormSelect';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, App, Button, Dropdown, Form, Input, Modal, Switch, Table } from 'antd';
import { get, errMsg } from '../../api/client';
import { fullName } from '../../components/ui';
import { Cover, useDebounce } from '../../components/feedback';
import { useAdminSave } from './useAdminSave';
const categories = ['NEWS', 'INTERVIEW', 'ATHLETE_STORY', 'HIGHLIGHT', 'TRAINING', 'BEHIND_THE_SCENES', 'FACE_OFF', 'CHAMPIONSHIP'];
export default function MediaAdmin() {
  const {modal}=App.useApp();
  const [search,setSearch]=useState(''); const [category,setCategory]=useState<string>();
  const [athleteSearch,setAthleteSearch]=useState(''); const debounced=useDebounce(athleteSearch);
  const athletes=useQuery({queryKey:['media-athletes',debounced],queryFn:()=>get('/admin/athletes',{search:debounced,limit:50})});
  const q = useQuery({ queryKey: ['a-media'], queryFn: () => get('/admin/media') });
  const [editing, setEditing] = useState<any>(); const [preview,setPreview]=useState(false);
  const [form] = Form.useForm();
  const save = useAdminSave();
  const cover=Form.useWatch('coverUrl',form);const title=Form.useWatch('title',form);const content=Form.useWatch('content',form);const excerpt=Form.useWatch('excerpt',form);
  function open(p: any) { setPreview(false); form.resetFields(); form.setFieldsValue(p); setEditing(p); }
  return <>
    <div className="admin-toolbar"><Button type="primary" onClick={() => open({ category: 'NEWS', isPublished: false })}>Создать материал</Button><Input.Search aria-label="Поиск материала" placeholder="Поиск материала" allowClear onChange={e=>setSearch(e.target.value)}/><Select aria-label="Категория материала" placeholder="Все категории" allowClear style={{width:200}} onChange={setCategory} options={categories.map(value=>({value,label:value}))}/></div>
    {q.isError && <Alert type="error" message={errMsg(q.error)} />}
    <Table loading={q.isLoading} rowKey="id" scroll={{x:650}} dataSource={q.data?.filter((p:any)=>p.title.toLowerCase().includes(search.toLowerCase())&&(!category||p.category===category))} columns={[
      { title: 'Заголовок', dataIndex: 'title' }, { title: 'Тип', dataIndex: 'category', render: v => v === 'BEHIND_THE_SCENES' ? 'BACKSTAGE' : v },
      { title: 'Опубликован', render: (_: any, p: any) => <Switch aria-label={"Публикация: "+p.title} checked={p.isPublished} disabled={save.isPending} onChange={isPublished => save.mutate({ method: 'patch', url: `/media/${p.id}`, data: { isPublished } })} /> },
      {title:'Действия',render:(_:any,p:any)=><Dropdown trigger={['click']} menu={{items:[{key:'edit',label:'Редактировать'},{key:'delete',label:'Удалить',danger:true}],onClick:({key})=>{if(key==='edit')open(p);else modal.confirm({title:'Удалить материал?',onOk:()=>save.mutate({method:'delete',url:'/media/'+p.id})});}}}><Button aria-label={'Действия: '+p.title}>•••</Button></Dropdown>},
    ]} />
    <Modal title="Материал" open={!!editing} onCancel={() => setEditing(undefined)} onOk={() => form.submit()} confirmLoading={save.isPending}>
      <Button style={{marginBottom:16}} onClick={()=>setPreview(v=>!v)}>{preview?'Вернуться к редактированию':'Предпросмотр'}</Button>{preview&&<article className="card"><Cover src={cover} alt={title}/><h2>{title || 'Без заголовка'}</h2><p>{excerpt}</p><div className="prose">{content}</div></article>}<Form style={{display:preview?'none':undefined}} disabled={save.isPending} form={form} layout="vertical" onFinish={data => save.mutate({ method: editing.id ? 'patch' : 'post', url: editing.id ? `/media/${editing.id}` : '/media', data }, { onSuccess: () => setEditing(undefined) })}>
        <Form.Item name="title" label="Заголовок" rules={[{ required: true }]}><Input /></Form.Item>
        <Form.Item name="category" label="Тип" rules={[{ required: true }]}><Select options={categories.map(value => ({ value, label: value === 'BEHIND_THE_SCENES' ? 'BACKSTAGE' : value }))} /></Form.Item>
        <Form.Item name="excerpt" label="Анонс"><Input.TextArea /></Form.Item>
        <Form.Item name="content" label="Текст" rules={[{ required: true }]}><Input.TextArea rows={8} /></Form.Item>
        <Form.Item name="coverUrl" label="Обложка (URL)"><Input /></Form.Item><Cover src={cover} alt={title ?? 'Предпросмотр'}/><Form.Item name="athleteId" label="Связанный спортсмен"><Select showSearch allowClear filterOption={false} onSearch={setAthleteSearch} onClear={()=>form.setFieldValue('athleteId',null)} options={athletes.data?.items.map((a:any)=>({value:a.id,label:fullName(a)}))}/></Form.Item><p className="muted">Материал можно связать со спортсменом.</p>
        <Form.Item name="isPublished" label="Опубликован" valuePropName="checked"><Switch /></Form.Item>
      </Form>
    </Modal>
  </>;
}
