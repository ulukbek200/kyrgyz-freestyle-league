
import { useId, type ReactNode } from 'react';
import { Button, Drawer, Typography } from 'antd';
import { ArrowLeft, Check, X } from 'lucide-react';
import './AdminEditorLayout.css';

type AdminEditorLayoutProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave: () => void;
  saving?: boolean;
  children: ReactNode;
  aside?: ReactNode;
  saveText?: string;
};

export default function AdminEditorLayout({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saving = false,
  children,
  aside,
  saveText = 'Сохранить',
}: AdminEditorLayoutProps) {
  const headingId = useId();
  return (
    <Drawer
      open={open}
      onClose={() => !saving && onClose()}
      placement="right"
      width="min(1040px, 100vw)"
      closable={false}
      maskClosable={false}
      keyboard={!saving}
      destroyOnHidden
      rootClassName="kfl-editor-drawer"
      aria-labelledby={headingId}
      styles={{
        header: { display: 'none' },
        body: {
          padding: 0,
          overflow: 'hidden',
        },
      }}
    >
      <div className="kfl-editor">
        <header className="kfl-editor-header">
          <div className="kfl-editor-heading">
            <Button
              type="text"
              icon={<ArrowLeft size={19} />}
              onClick={onClose}
              disabled={saving}
              aria-label="Назад"
            />

            <div className="kfl-editor-heading-text">
              <Typography.Text className="kfl-editor-eyebrow">
                {subtitle || 'KFL CONTROL CENTER'}
              </Typography.Text>

              <Typography.Title level={3} id={headingId}>
                {title}
              </Typography.Title>
            </div>
          </div>

          <Button
            type="text"
            icon={<X size={20} />}
            onClick={onClose}
            disabled={saving}
            aria-label="Закрыть редактор"
          />
        </header>

        <div
          className={
            aside
              ? 'kfl-editor-content has-aside'
              : 'kfl-editor-content'
          }
        >
          <main className="kfl-editor-main">
            {children}
          </main>

          {aside && (
            <aside className="kfl-editor-aside">
              {aside}
            </aside>
          )}
        </div>

        <footer className="kfl-editor-footer">
          <span className="kfl-editor-footer-note">
            Проверьте данные перед сохранением
          </span>

          <div className="kfl-editor-footer-actions">
            <Button
              onClick={onClose}
              disabled={saving}
              size="large"
            >
              Отмена
            </Button>

            <Button
              type="primary"
              size="large"
              icon={<Check size={17} />}
              loading={saving}
              onClick={onSave}
            >
              {saveText}
            </Button>
          </div>
        </footer>
      </div>
    </Drawer>
  );
}
