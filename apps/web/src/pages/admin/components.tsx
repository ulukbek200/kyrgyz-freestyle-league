import {mediaUrl} from '../../mediaUrl';

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from 'react';

import {
  Alert,
  App,
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Skeleton,
  Tag,
} from 'antd';

import {
  Camera,
  Plus,
  RefreshCw,
} from 'lucide-react';

import {
  apiRequest,
  Session,
  type Row,
} from './api';

import AdminEditorLayout from './AdminEditorLayout';

/* =========================================
   LABELS AND STATUSES
   ========================================= */

export const labels: Record<string, string> = {
  ACTIVE: 'Активен',
  INACTIVE: 'В архиве',
  PENDING: 'Новая',
  REVIEW: 'На рассмотрении',
  APPROVED: 'Одобрена',
  REJECTED: 'Отклонена',
  SUSPENDED: 'Отстранён',
  RETIRED: 'Завершил карьеру',
  UPCOMING: 'Предстоящая',
  LIVE: 'В эфире',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  ADMIN: 'Администратор',
  MODERATOR: 'Модератор',
  ATHLETE: 'Спортсмен',
  DECISION: 'По баллам',
  TECHNICAL_FALL: 'Техническое превосходство',
  PIN: 'Туше',
  FORFEIT: 'Неявка',
};

export const statusOptions = (values: string[]) =>
  values.map(value => ({
    value,
    label: labels[value] || value,
  }));

export function Status({
  value,
}: {
  value: string;
}) {
  return (
    <Tag
      className={`kfl-status status-${value.toLowerCase()}`}
    >
      {labels[value] || value}
    </Tag>
  );
}

/* =========================================
   PAGE HEADER
   ========================================= */

export function PageTitle({
  eyebrow = 'УПРАВЛЕНИЕ ЛИГОЙ',
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="kfl-page-title">
      <div>
        <span className="kfl-eyebrow">
          {eyebrow}
        </span>

        <h1>
          {title}
          <span>.</span>
        </h1>

        <p>{description}</p>
      </div>

      {action}
    </div>
  );
}

/* =========================================
   ADD BUTTON
   ========================================= */

export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      type="primary"
      icon={<Plus size={16} />}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/* =========================================
   LOADING / ERROR / EMPTY
   ========================================= */

export function DataState({
  query,
  children,
  empty,
}: {
  query: {
    isPending: boolean;
    error: Error | null;
    refetch: () => unknown;
  };
  children: ReactNode;
  empty?: boolean;
}) {
  if (query.isPending) {
    return (
      <div className="kfl-panel">
        <Skeleton
          active
          paragraph={{ rows: 6 }}
        />
      </div>
    );
  }

  if (query.error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Не удалось загрузить данные"
        description={query.error.message}
        action={
          <Button
            onClick={() => query.refetch()}
            icon={<RefreshCw size={14} />}
          >
            Повторить
          </Button>
        }
      />
    );
  }

  if (empty) {
    return (
      <div className="kfl-panel">
        <Empty description="Здесь пока нет записей" />
      </div>
    );
  }

  return <>{children}</>;
}

/* =========================================
   ATHLETE PREVIEW
   ========================================= */

export function Person({
  athlete,
}: {
  athlete: Row;
}) {
  return (
    <div className="kfl-person">
      <Avatar
        size={38}
        shape="square"
        src={mediaUrl(athlete.imageUrl)}
      >
        {athlete.firstName?.[0]}
        {athlete.lastName?.[0]}
      </Avatar>

      <div>
        <strong>
          {athlete.firstName} {athlete.lastName}
        </strong>

        <small>
          {athlete.city ||
            athlete.nickname ||
            'Спортсмен KFL'}
        </small>
      </div>
    </div>
  );
}

/* =========================================
   UPLOAD PROGRESS CONTEXT
   ========================================= */

const UploadProgress = createContext<
  (busy: boolean) => void
>(() => {});

/* =========================================
   PROFESSIONAL FORM EDITOR
   ========================================= */

type FormDialogProps = {
  title: string;
  open: boolean;
  onClose: () => void;
  pending: boolean;
  children: ReactNode;
  form: any;
  onFinish: (values: any) => void;
};

export function FormDialog({
  title,
  open,
  onClose,
  pending,
  children,
  form,
  onFinish,
}: FormDialogProps) {
  const [uploading, setUploading] = useState(false);

  const busy = pending || uploading;

  const handleClose = () => {
    if (!busy) {
      onClose();
    }
  };

  const handleSave = () => {
    if (!busy) {
      form.submit();
    }
  };

  const handleFinish = (values: any) => {
    if (!busy) {
      onFinish(values);
    }
  };

  return (
    <UploadProgress.Provider value={setUploading}>
      <AdminEditorLayout
        open={open}
        title={title}
        subtitle="KFL CONTROL CENTER / УПРАВЛЕНИЕ ЛИГОЙ"
        onClose={handleClose}
        onSave={handleSave}
        saving={busy}
        saveText="Сохранить"
      >
        <Form
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={handleFinish}
          scrollToFirstError={{block: 'center'}}
          className="kfl-professional-form"
        >
          <div className="kfl-form-grid">
            {children}
          </div>
        </Form>
      </AdminEditorLayout>
    </UploadProgress.Provider>
  );
}

/* =========================================
   VALIDATION
   ========================================= */

export const required = [
  {
    required: true,
    message: 'Заполните это поле',
  },
];

/* =========================================
   TEXT FIELD
   ========================================= */

export function TextField({
  name,
  label,
  wide = false,
  required: needed = true,
  type = 'text',
}: {
  name: string;
  label: string;
  wide?: boolean;
  required?: boolean;
  type?: string;
}) {
  return (
    <Form.Item
      name={name}
      label={label}
      className={wide ? 'wide' : ''}
      rules={needed ? required : undefined}
    >
      <Input type={type} />
    </Form.Item>
  );
}

/* =========================================
   IMAGE UPLOAD
   ========================================= */

export function ImageField({
  value,
  onChange,
}: {
  value?: string | null;
  onChange?: (value: string | null) => void;
}) {
  const { token } = useContext(Session);
  const { message } = App.useApp();

  const [busy, setBusy] = useState(false);

  const setUploading = useContext(UploadProgress);

  async function handleUpload(
    file: File | undefined
  ) {
    if (!file) return;

    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
    ];

    if (!allowedTypes.includes(file.type)) {
      message.error(
        'Разрешены только JPG, PNG и WebP'
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      message.error(
        'Максимальный размер файла — 5 МБ'
      );
      return;
    }

    setBusy(true);
    setUploading(true);

    try {
      const data = await apiRequest<{
        url: string;
      }>(
        '/admin/uploads',
        token,
        {
          method: 'POST',
          file,
        }
      );

      onChange?.(data.url);

      message.success(
        'Фотография успешно загружена'
      );
    } catch (error) {
      message.error(
        error instanceof Error
          ? error.message
          : 'Ошибка загрузки фотографии'
      );
    } finally {
      setBusy(false);
      setUploading(false);
    }
  }

  return (
    <div className="kfl-image-field">
      {value && (
        <img
          src={mediaUrl(value)}
          alt="Предпросмотр фотографии"
        />
      )}

      <div>
        <label className="kfl-file-button">
          <Camera size={16} />

          {busy
            ? 'Загрузка…'
            : 'Загрузить фотографию'}

          <input
            aria-label="Загрузить фотографию"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={async event => {
              const input = event.currentTarget;
              const file = input.files?.[0];

              await handleUpload(file);

              input.value = '';
            }}
          />
        </label>

        <small>
          JPG, PNG или WebP · до 5 МБ
        </small>

        {value && (
          <Button
            type="link"
            danger
            disabled={busy}
            onClick={() => onChange?.(null)}
          >
            Убрать фотографию
          </Button>
        )}
      </div>
    </div>
  );
}
