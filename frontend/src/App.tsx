import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { OfflineGate } from './components/layout/OfflineGate'
import { ChangePasswordPage } from './pages/account/ChangePasswordPage'
import { MyInfoPage } from './pages/account/MyInfoPage'
import { FindIdPage } from './pages/auth/FindIdPage'
import { FindPasswordPage } from './pages/auth/FindPasswordPage'
import { LoginPage } from './pages/auth/LoginPage'
import { SignupPage } from './pages/auth/SignupPage'
import { ErrorPage } from './pages/errors/ErrorPage'
import { NotFoundPage } from './pages/errors/NotFoundPage'
import { OfflinePage } from './pages/errors/OfflinePage'
import { AvailabilityPage } from './pages/schedule/AvailabilityPage'
import { ChangeMeetingPage } from './pages/schedule/ChangeMeetingPage'
import { SchedulePage } from './pages/schedule/SchedulePage'
import { VoteCancelPage } from './pages/schedule/VoteCancelPage'
import { VotePage } from './pages/schedule/VotePage'
import { CreateTeamPage } from './pages/teams/CreateTeamPage'
import { JoinTeamPage } from './pages/teams/JoinTeamPage'
import { LeaveTeamPage } from './pages/teams/LeaveTeamPage'
import { MembersPage } from './pages/teams/MembersPage'
import { TeamHomePage } from './pages/teams/TeamHomePage'
import { TeamListPage } from './pages/teams/TeamListPage'
import { TransferLeaderPage } from './pages/teams/TransferLeaderPage'
import { TimetableManualPage } from './pages/timetable/TimetableManualPage'
import { TimetablePage } from './pages/timetable/TimetablePage'
import { GoalDeletePage } from './pages/todos/GoalDeletePage'
import { GoalFormPage } from './pages/todos/GoalFormPage'
import { TodoDetailPage } from './pages/todos/TodoDetailPage'
import { TodoListPage } from './pages/todos/TodoListPage'
import { useStore } from './store'

/** 로그인하지 않았으면 로그인 화면으로 보낸다 */
function RequireLogin() {
  const loggedIn = useStore((s) => s.currentUserId !== null)
  return loggedIn ? <Outlet /> : <Navigate to="/login" replace />
}

/**
 * 화면 주소 목록.
 * HashRouter(주소에 # 사용)를 쓰는 이유: 정적 파일로 배포해도 새로고침 시 404 가 나지 않는다.
 */
export default function App() {
  return (
    <HashRouter>
      <OfflineGate>
      <Routes>
        <Route path="/" element={<Navigate to="/teams" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/find-id" element={<FindIdPage />} />
        <Route path="/find-password" element={<FindPasswordPage />} />
        <Route path="/offline" element={<OfflinePage />} />
        <Route path="/error" element={<ErrorPage />} />

        <Route element={<RequireLogin />}>
          <Route path="/join/:code" element={<JoinTeamPage />} />

          {/* 팀 밖 메인 메뉴 */}
          <Route path="/teams" element={<TeamListPage />} />
          <Route path="/teams/new" element={<CreateTeamPage />} />
          <Route path="/timetable" element={<TimetablePage />} />
          <Route path="/timetable/manual" element={<TimetableManualPage />} />
          <Route path="/me" element={<MyInfoPage />} />
          <Route path="/me/password" element={<ChangePasswordPage />} />

          {/* 팀 안 메뉴 */}
          <Route path="/teams/:teamId" element={<TeamHomePage />} />
          <Route path="/teams/:teamId/schedule" element={<SchedulePage />} />
          <Route path="/teams/:teamId/availability" element={<AvailabilityPage />} />
          <Route path="/teams/:teamId/vote" element={<VotePage />} />
          <Route path="/teams/:teamId/vote/cancel" element={<VoteCancelPage />} />
          <Route path="/teams/:teamId/meeting/change" element={<ChangeMeetingPage />} />
          <Route path="/teams/:teamId/todos" element={<TodoListPage />} />
          <Route path="/teams/:teamId/todos/goals/new" element={<GoalFormPage />} />
          <Route path="/teams/:teamId/todos/goals/:goalId/edit" element={<GoalFormPage />} />
          <Route path="/teams/:teamId/todos/goals/:goalId/delete" element={<GoalDeletePage />} />
          <Route path="/teams/:teamId/todos/:todoId" element={<TodoDetailPage />} />
          <Route path="/teams/:teamId/members" element={<MembersPage />} />
          <Route path="/teams/:teamId/members/transfer" element={<TransferLeaderPage />} />
          <Route path="/teams/:teamId/members/leave" element={<LeaveTeamPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      </OfflineGate>
    </HashRouter>
  )
}
