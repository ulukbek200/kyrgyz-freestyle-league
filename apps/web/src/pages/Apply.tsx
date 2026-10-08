
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  App as AntApp,
  Button,
  Checkbox,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Upload,
} from 'antd';
import type { UploadProps } from 'antd';
import {
  ArrowLeftOutlined,
  ArrowRightOutlined,
  CameraOutlined,
  CheckCircleFilled,
  DeleteOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { api, errMsg } from '../api/client';
import { useTitle } from '../components/ui';
import './Apply.css';

const STEPS = [
  {
    number: '01',
    title: 'Личные данные',
    subtitle: 'Кто ты',
  },
  {
    number: '02',
    title: 'Спортивный путь',
    subtitle: 'Твоя история',
  },
  {
    number: '03',
    title: 'Медиа',
    subtitle: 'Покажи себя',
  },
  {
    number: '04',
    title: 'Подтверждение',
    subtitle: 'Последний шаг',
  },
];

const PHOTO_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
];

const VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
];

const PHOTO_LIMIT = 5 * 1024 * 1024;
const VIDEO_LIMIT = 100 * 1024 * 1024;

const STEP_FIELDS = [
  [
    'firstName',
    'lastName',
    'birthDate',
    'weightKg',
    'country',
    'city',
    'phone',
    'email',
  ],
  [],
  [],
  ['agree'],
];

type MediaPickerProps = {
  type: 'photo' | 'video';
  file: File | null;
  preview: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
  onError: (text: string) => void;
};

function MediaPicker({
  type,
  file,
  preview,
  onSelect,
  onRemove,
  onError,
}: MediaPickerProps) {
  const isPhoto = type === 'photo';
  const Icon = isPhoto
    ? CameraOutlined
    : VideoCameraOutlined;

  const props: UploadProps = {
    accept: isPhoto
      ? 'image/jpeg,image/png,image/webp'
      : 'video/mp4,video/quicktime,video/webm',

    multiple: false,
    maxCount: 1,
    showUploadList: false,

    beforeUpload: (selected) => {
      const allowed = isPhoto
        ? PHOTO_TYPES
        : VIDEO_TYPES;

      const limit = isPhoto
        ? PHOTO_LIMIT
        : VIDEO_LIMIT;

      if (!allowed.includes(selected.type)) {
        onError(
          isPhoto
            ? 'Разрешены JPG, PNG и WEBP'
            : 'Разрешены MP4, MOV и WEBM'
        );

        return Upload.LIST_IGNORE;
      }

      if (selected.size > limit) {
        onError(
          isPhoto
            ? 'Максимальный размер фото — 5 МБ'
            : 'Максимальный размер видео — 100 МБ'
        );

        return Upload.LIST_IGNORE;
      }

      onSelect(selected);

      // Файл остаётся только в памяти браузера.
      // Никакого запроса на сервер не происходит.
      return false;
    },
  };

  return (
    <div className="kfl-media-block">
      <div className="kfl-media-heading">
        <div className="kfl-media-icon">
          <Icon />
        </div>

        <div>
          <h3>
            {isPhoto ? 'ТВОЁ ФОТО' : 'ТВОЯ ИСТОРИЯ'}
          </h3>

          <p>
            {isPhoto
              ? 'Фотография для профиля спортсмена'
              : 'Видео о себе, тренировках и целях'}
          </p>
        </div>
      </div>

      <Upload.Dragger
        {...props}
        className="kfl-uploader"
      >
        <div className="kfl-upload-inner">
          <Icon className="kfl-upload-symbol" />

          <strong>
            {file
              ? 'ЗАМЕНИТЬ ФАЙЛ'
              : isPhoto
                ? 'ВЫБРАТЬ ФОТО'
                : 'ВЫБРАТЬ ВИДЕО'}
          </strong>

          <span>
            Нажми, чтобы выбрать из галереи
          </span>

          <small>
            {isPhoto
              ? 'JPG / PNG / WEBP · ДО 5 МБ'
              : 'MP4 / MOV / WEBM · ДО 100 МБ'}
          </small>
        </div>
      </Upload.Dragger>

      {file && preview && (
        <div className="kfl-media-preview">
          {isPhoto ? (
            <img
              src={preview}
              alt="Фото спортсмена"
            />
          ) : (
            <video
              src={preview}
              controls
              playsInline
              preload="metadata"
            />
          )}

          <div className="kfl-file-info">
            <div>
              <CheckCircleFilled className="kfl-check" />

              <strong>{file.name}</strong>

              <small>
                {(file.size / 1024 / 1024).toFixed(1)} МБ
              </small>
            </div>

            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                onRemove();
              }}
            >
              Удалить
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ApplyContent() {
  const { t } = useTranslation();
  const { message } = AntApp.useApp();

  useTitle(t('nav.apply'));

  const [form] = Form.useForm();

  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('idle');
  const [loading, setLoading] = useState(false);

  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);

  const [photoPreview, setPhotoPreview] = useState('');
  const [videoPreview, setVideoPreview] = useState('');

  const pending = useRef(false);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return;
    }

    const url = URL.createObjectURL(photo);
    setPhotoPreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [photo]);

  useEffect(() => {
    if (!video) {
      setVideoPreview('');
      return;
    }

    const url = URL.createObjectURL(video);
    setVideoPreview(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [video]);

  const scrollTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const next = async () => {
    try {
      if (step === 0) {
        await form.validateFields(STEP_FIELDS[0]);
      }

      // Фото и видео необязательны.
      setStep((current) => Math.min(current + 1, 3));
      scrollTop();
    } catch {
      message.error('Проверь обязательные поля');
    }
  };

  const previous = () => {
    setStep((current) => Math.max(current - 1, 0));
    scrollTop();
  };

  const submit = async (values: any) => {
    if (step !== 3 || pending.current) {
      return;
    }

    pending.current = true;
    setLoading(true);
    setStatus('idle');

    try {
      // Медиафайлы НЕ отправляются.
      // Сохраняются только текстовые данные.
      await api.post('/applications', {
        ...values,
        birthDate: values.birthDate.toISOString(),
        photoUrl: '',
        videoUrl: '',
        agreed: true,
      });

      setStatus('ok');
      scrollTop();
    } catch (error) {
      setStatus(errMsg(error));
      message.error('Не удалось отправить заявку');
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };

  const required = [
    {
      required: true,
      message: 'Обязательное поле',
    },
  ];

  if (status === 'ok') {
    return (
      <div className="kfl-apply-page">
        <div className="kfl-success">
          <CheckCircleFilled />

          <span>KYRGYZ FREESTYLE LEAGUE</span>

          <h1>ЗАЯВКА ОТПРАВЛЕНА.</h1>

          <p>
            Твоя заявка поступила организаторам.
            Мы свяжемся с тобой после рассмотрения.
          </p>

          <Button
            size="large"
            onClick={() => window.location.assign('/')}
          >
            На главную
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="kfl-apply-page">
      <div className="kfl-apply-shell">
        <section className="kfl-apply-hero">
          <div className="kfl-hero-content">
            <div className="kfl-hero-top">
              <span className="kfl-eyebrow">
                <span className="kfl-red-dot" />
                KYRGYZ FREESTYLE LEAGUE
              </span>

              <span className="kfl-season-tag">
                ATHLETE REGISTRATION
              </span>
            </div>

            <div className="kfl-hero-title">
              <span>ТВОЙ ВЫХОД.</span>
              <span>ТВОЯ БОРЬБА.</span>
              <span className="kfl-accent">
                ТВОЯ ИСТОРИЯ.
              </span>
            </div>

            <p className="kfl-hero-description">
              Каждый чемпион когда-то сделал первый шаг.
              Заполни заявку и заяви о себе на ковре
              Кыргызской лиги вольной борьбы.
            </p>

            <div className="kfl-hero-bottom">
              <span>
                <ThunderboltOutlined /> ХАРАКТЕР
              </span>

              <span>
                <SafetyCertificateOutlined /> ДИСЦИПЛИНА
              </span>

              <span>
                <CheckCircleFilled /> ПОБЕДА
              </span>
            </div>
          </div>

          <div className="kfl-hero-watermark">
            KFL
          </div>
        </section>

        <section className="kfl-application-container">
          <div className="kfl-step-navigation">
            {STEPS.map((item, index) => (
              <div
                key={item.number}
                className={
                  'kfl-step ' +
                  (index === step ? 'active ' : '') +
                  (index < step ? 'completed' : '')
                }
              >
                <span className="kfl-step-number">
                  {index < step ? (
                    <CheckCircleFilled />
                  ) : (
                    item.number
                  )}
                </span>

                <div>
                  <strong>{item.title}</strong>
                  <small>{item.subtitle}</small>
                </div>
              </div>
            ))}
          </div>

          <div className="kfl-form-panel">
            <div className="kfl-progress-top">
              <span>РЕГИСТРАЦИЯ АТЛЕТА</span>
              <span>{step + 1} / 4</span>
            </div>

            <div className="kfl-progress-track">
              <div
                style={{
                  width: `${((step + 1) / 4) * 100}%`,
                }}
              />
            </div>

            {status !== 'idle' && (
              <Alert
                type="error"
                showIcon
                message={status}
                style={{ marginBottom: 24 }}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              disabled={loading}
              onFinish={submit}
              initialValues={{
                country: 'Кыргызстан',
              }}
              requiredMark={false}
              className="kfl-form"
            >
              {/* ШАГ 1 — ЛИЧНЫЕ ДАННЫЕ */}
              <div
                style={{
                  display: step === 0 ? 'block' : 'none',
                }}
              >
                <div className="kfl-section-heading">
                  <span>01 / PERSONAL DETAILS</span>
                  <h2>НАЧНЁМ С ТЕБЯ.</h2>

                  <p>
                    Расскажи немного о себе. Эти данные
                    нужны для регистрации в лиге.
                  </p>
                </div>

                <div className="kfl-fields-grid">
                  <Form.Item
                    name="firstName"
                    label="ИМЯ"
                    rules={required}
                  >
                    <Input
                      size="large"
                      placeholder="Твоё имя"
                    />
                  </Form.Item>

                  <Form.Item
                    name="lastName"
                    label="ФАМИЛИЯ"
                    rules={required}
                  >
                    <Input
                      size="large"
                      placeholder="Фамилия"
                    />
                  </Form.Item>

                  <Form.Item
                    name="birthDate"
                    label="ДАТА РОЖДЕНИЯ"
                    rules={required}
                  >
                    <DatePicker
                      size="large"
                      format="DD.MM.YYYY"
                      style={{ width: '100%' }}
                      disabledDate={(date) =>
                        !!date &&
                        date.isAfter(new Date(), 'day')
                      }
                    />
                  </Form.Item>

                  <Form.Item
                    name="weightKg"
                    label="ВЕС / КГ"
                    rules={required}
                  >
                    <InputNumber
                      size="large"
                      min={30}
                      max={200}
                      style={{ width: '100%' }}
                      placeholder="65"
                    />
                  </Form.Item>

                  <Form.Item
                    name="country"
                    label="СТРАНА"
                    rules={required}
                  >
                    <Input size="large" />
                  </Form.Item>

                  <Form.Item
                    name="city"
                    label="ГОРОД / РАЙОН"
                    rules={required}
                  >
                    <Input
                      size="large"
                      placeholder="Нарын"
                    />
                  </Form.Item>

                  <Form.Item
                    name="phone"
                    label="ТЕЛЕФОН"
                    rules={required}
                  >
                    <Input
                      size="large"
                      placeholder="+996 700 000 000"
                    />
                  </Form.Item>

                  <Form.Item
                    name="email"
                    label="EMAIL"
                    rules={[
                      ...required,
                      {
                        type: 'email',
                        message: 'Неверный email',
                      },
                    ]}
                  >
                    <Input
                      size="large"
                      placeholder="example@gmail.com"
                    />
                  </Form.Item>
                </div>
              </div>

              {/* ШАГ 2 — СПОРТИВНЫЙ ПУТЬ */}
              <div
                style={{
                  display: step === 1 ? 'block' : 'none',
                }}
              >
                <div className="kfl-section-heading">
                  <span>02 / ATHLETE BACKGROUND</span>
                  <h2>ТВОЙ ПУТЬ В БОРЬБЕ.</h2>

                  <p>
                    Каждая победа начинается с тренировок.
                    Расскажи о своём спортивном опыте.
                  </p>
                </div>

                <div className="kfl-fields-grid">
                  <Form.Item
                    name="club"
                    label="СПОРТИВНЫЙ КЛУБ"
                  >
                    <Input
                      size="large"
                      placeholder="Название клуба"
                    />
                  </Form.Item>

                  <Form.Item
                    name="coach"
                    label="ТРЕНЕР"
                  >
                    <Input
                      size="large"
                      placeholder="ФИО тренера"
                    />
                  </Form.Item>
                </div>

                <Form.Item
                  name="experience"
                  label="ОПЫТ В ВОЛЬНОЙ БОРЬБЕ"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Сколько лет тренируешься? Где начинал?"
                  />
                </Form.Item>

                <Form.Item
                  name="achievements"
                  label="СПОРТИВНЫЕ ДОСТИЖЕНИЯ"
                >
                  <Input.TextArea
                    rows={4}
                    placeholder="Турниры, медали, чемпионаты..."
                  />
                </Form.Item>

                <Form.Item
                  name="socialLinks"
                  label="СОЦИАЛЬНЫЕ СЕТИ"
                >
                  <Input
                    size="large"
                    placeholder="Instagram, TikTok или другие"
                  />
                </Form.Item>
              </div>

              {/* ШАГ 3 — МЕДИА */}
              <div
                style={{
                  display: step === 2 ? 'block' : 'none',
                }}
              >
                <div className="kfl-section-heading">
                  <span>03 / ATHLETE MEDIA</span>
                  <h2>ПОКАЖИ, КТО ТЫ.</h2>

                  <p>
                    Можешь выбрать фото и видео из галереи
                    телефона или компьютера для предпросмотра.
                  </p>
                </div>

                <Alert
                  type="info"
                  showIcon
                  message="Предпросмотр медиа"
                  description="На этом этапе фото и видео не сохраняются и не отправляются организаторам. Этот шаг необязательный."
                  style={{ marginBottom: 24 }}
                />

                <div className="kfl-media-grid">
                  <MediaPicker
                    type="photo"
                    file={photo}
                    preview={photoPreview}
                    onSelect={setPhoto}
                    onRemove={() => setPhoto(null)}
                    onError={(text) => message.error(text)}
                  />

                  <MediaPicker
                    type="video"
                    file={video}
                    preview={videoPreview}
                    onSelect={setVideo}
                    onRemove={() => setVideo(null)}
                    onError={(text) => message.error(text)}
                  />
                </div>
              </div>

              {/* ШАГ 4 — ПОДТВЕРЖДЕНИЕ */}
              <div
                style={{
                  display: step === 3 ? 'block' : 'none',
                }}
              >
                <div className="kfl-section-heading">
                  <span>04 / FINAL CONFIRMATION</span>
                  <h2>ТЫ ГОТОВ?</h2>

                  <p>
                    Проверь информацию и подтверди
                    отправку заявки организаторам.
                  </p>
                </div>

                <div className="kfl-final-banner">
                  <ThunderboltOutlined />

                  <div>
                    <strong>
                      ТВОЙ СЛЕДУЮЩИЙ ШАГ — КОВЁР.
                    </strong>

                    <p>
                      После отправки организаторы
                      рассмотрят заявку и свяжутся с тобой.
                    </p>
                  </div>
                </div>

                <Form.Item
                  name="medicalInfo"
                  label="МЕДИЦИНСКАЯ ИНФОРМАЦИЯ"
                  extra="Не публикуется в профиле спортсмена."
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Информация для организаторов"
                  />
                </Form.Item>

                <Form.Item
                  name="agree"
                  valuePropName="checked"
                  rules={[
                    {
                      validator: (_, value) =>
                        value
                          ? Promise.resolve()
                          : Promise.reject(
                              new Error(
                                'Необходимо согласие'
                              )
                            ),
                    },
                  ]}
                >
                  <Checkbox>
                    Я согласен с правилами лиги
                    и обработкой персональных данных.
                  </Checkbox>
                </Form.Item>
              </div>

              {/* КНОПКИ */}
              <div className="kfl-form-actions">
                {step > 0 ? (
                  <Button
                    size="large"
                    icon={<ArrowLeftOutlined />}
                    onClick={previous}
                    disabled={loading}
                    className="kfl-back-button"
                  >
                    НАЗАД
                  </Button>
                ) : (
                  <span />
                )}

                {step < 3 ? (
                  <Button
                    type="primary"
                    size="large"
                    onClick={next}
                    className="kfl-next-button"
                  >
                    ПРОДОЛЖИТЬ <ArrowRightOutlined />
                  </Button>
                ) : (
                  <Button
                    type="primary"
                    size="large"
                    htmlType="submit"
                    loading={loading}
                    className="kfl-next-button"
                  >
                    ОТПРАВИТЬ ЗАЯВКУ
                    <ArrowRightOutlined />
                  </Button>
                )}
              </div>
            </Form>
          </div>
        </section>

        <div className="kfl-apply-footer">
          <span>
            KFL © {new Date().getFullYear()}
          </span>

          <span>
            DISCIPLINE / RESPECT / VICTORY
          </span>
        </div>
      </div>
    </div>
  );
}

// Собственный контекст Ant Design для уведомлений.
export default function Apply() {
  return (
    <AntApp>
      <ApplyContent />
    </AntApp>
  );
}
