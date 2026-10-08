import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Alert, Button, Form, Input } from 'antd';
import { api, errMsg } from '../../api/client';
import { useAuth } from '../../store/auth';

export default function Login() {
  const nav = useNavigate();
  const { token, user, login } = useAuth();
  const [err, setErr] = useState(''); const [busy,setBusy]=useState(false);
  if (token && user?.role === 'ADMIN') return <Navigate to="/admin" replace />;
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--ink)', padding: 16 }}>
      <div style={{ background: '#fff', padding: 28, width: '100%', maxWidth: 380 }}>
        <h1 className="display" style={{ fontSize: 40, marginBottom: 16 }}>Admin</h1>
        {err && <Alert type="error" message={err} style={{ marginBottom: 12 }} />}
        <Form layout="vertical" initialValues={{ email: 'admin@league.kg' }} onFinish={async (v) => {
          if(busy)return;setBusy(true);setErr('');try { const r = (await api.post('/auth/login', v)).data; if(r.user.role!=='ADMIN'){setErr('Доступ разрешён только администраторам');return;}login(r.token, r.user); nav('/admin'); } catch (e) { setErr(errMsg(e)); } finally {setBusy(false);}
        }}>
          <Form.Item name="email" label="Email" rules={[{ required: true }]}><Input autoComplete="username" /></Form.Item>
          <Form.Item name="password" label="Пароль" rules={[{ required: true }]}><Input.Password autoComplete="current-password" /></Form.Item>
          <Button type="primary" htmlType="submit" loading={busy} block size="large">Войти</Button>
        </Form>
      </div>
    </div>
  );
}
