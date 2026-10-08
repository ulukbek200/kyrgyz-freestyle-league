
import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import Layout from './components/Layout';
import {
  ErrorBoundary,
  QueryError,
} from './components/feedback';
import { Loading } from './components/ui';

// Главная страница
const Home = lazy(() => import('./pages/Home'));

// Рейтинги
const Rankings = lazy(() => import('./pages/Rankings'));

// Спортсмены
const Athletes = lazy(() =>
  import('./pages/Athletes').then((module) => ({
    default: module.Athletes,
  }))
);

const AthleteProfile = lazy(() =>
  import('./pages/Athletes').then((module) => ({
    default: module.AthleteProfile,
  }))
);

// Поединки
const Matches = lazy(() =>
  import('./pages/Matches').then((module) => ({
    default: module.Matches,
  }))
);

const MatchPage = lazy(() =>
  import('./pages/Matches').then((module) => ({
    default: module.MatchPage,
  }))
);

// Турниры
const Events = lazy(() =>
  import('./pages/Events').then((module) => ({
    default: module.Events,
  }))
);

const EventPage = lazy(() =>
  import('./pages/Events').then((module) => ({
    default: module.EventPage,
  }))
);

// Чемпионы
const Champions = lazy(() =>
  import('./pages/Events').then((module) => ({
    default: module.Champions,
  }))
);

// Медиа
const Media = lazy(() =>
  import('./pages/KFLMedia').then((module) => ({
    default: module.Media,
  }))
);

const MediaPage = lazy(() =>
  import('./pages/KFLMedia').then((module) => ({
    default: module.MediaPage,
  }))
);

// Заявки
const Apply = lazy(() => import('./pages/Apply'));

// Админ-панель
const AdminLogin = lazy(() =>
  import('./pages/admin/Login')
);

const Admin = lazy(() =>
  import('./pages/admin/Admin')
);

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Loading />}>
        <Routes>
          {/* Административная часть */}
          <Route
            path="/admin/login"
            element={<AdminLogin />}
          />

          <Route
            path="/admin/*"
            element={<Admin />}
          />

          {/* Основной сайт KFL */}
          <Route element={<Layout />}>
            <Route
              index
              element={<Home />}
            />

            <Route
              path="rankings"
              element={<Rankings />}
            />

            <Route
              path="athletes"
              element={<Athletes />}
            />

            <Route
              path="athletes/:id"
              element={<AthleteProfile />}
            />

            <Route
              path="matches"
              element={<Matches />}
            />

            <Route
              path="matches/:id"
              element={<MatchPage />}
            />

            <Route
              path="events"
              element={<Events />}
            />

            <Route
              path="events/:id"
              element={<EventPage />}
            />

            <Route
              path="champions"
              element={<Champions />}
            />

            <Route
              path="media"
              element={<Media />}
            />

            <Route
              path="media/:id"
              element={<MediaPage />}
            />

            <Route
              path="apply"
              element={<Apply />}
            />

            {/* Страница 404 */}
            <Route
              path="*"
              element={
                <QueryError
                  error={{
                    response: {
                      status: 404,
                    },
                  }}
                />
              }
            />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
