import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import dayjs from 'dayjs';
import 'dayjs/locale/ru';
import './i18n';
import './styles.css';
import App from './App';

dayjs.locale('ru');
const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <ConfigProvider locale={ruRU} theme={{ token: { colorPrimary: '#b92d25', colorError: '#b92d25', colorTextDescription: '#596471', borderRadius: 6, controlHeight: 40, colorBgLayout: '#f3f2ee', colorText: '#152332', fontFamily: "'IBM Plex Sans', system-ui, sans-serif", colorInfo: '#1d4fd7' } }}>
        <BrowserRouter><App /></BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
