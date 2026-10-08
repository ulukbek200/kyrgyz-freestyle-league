import { Component, ReactNode, useEffect, useState } from 'react';
import { Button, Result, Skeleton } from 'antd';
import { Link } from 'react-router-dom';
export function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => { const timer = setTimeout(() => setDebounced(value), delay); return () => clearTimeout(timer); }, [value, delay]);
  return debounced;
}
export function QueryError({ error, retry }: { error?: any; retry?: () => unknown }) {
  const code = error?.response?.status;
  return <Result status={code === 404 ? '404' : code === 403 ? '403' : 'error'} title={code === 404 ? 'Страница не найдена' : code === 403 ? 'Доступ ограничен' : 'Не удалось загрузить данные'} subTitle={code === 404 ? 'Проверьте адрес или вернитесь на главную.' : 'Попробуйте ещё раз.'} extra={<>{retry && code !== 404 && <Button onClick={() => retry()}>Повторить</Button>} <Link to="/">На главную</Link></>} />;
}
export function QueryState({ query, children }: { query: any; children: ReactNode }) {
  if (query.isLoading) return <div className="loading-state" role="status" aria-label="Загрузка"><Skeleton active paragraph={{ rows: 5 }} /></div>;
  if (query.isError) return <QueryError error={query.error} retry={query.refetch} />;
  return <>{children}</>;
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <Result status="500" title="Не удалось открыть страницу" extra={<Button onClick={() => location.reload()}>Перезагрузить</Button>} /> : this.props.children; }
}
export function Cover({ src, alt = '', eager = false }: { src?: string; alt?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return <div className="cover">{src && !failed ? <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <div className="cover-placeholder" aria-label="Обложка отсутствует"><span>WRESTLING<br />LEAGUE</span></div>}</div>;
}
