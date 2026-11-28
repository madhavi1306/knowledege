import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import DashboardLayout from './layouts/DashboardLayout.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import MyPapersPage from './pages/MyPapersPage.jsx'
import AnalysisPage from './pages/AnalysisPage.jsx'
import DocumentLearningWorkspacePage from './pages/DocumentLearningWorkspacePage.jsx'
import VisualLearningWorkspacePage from './pages/VisualLearningWorkspacePage.jsx'
import DocumentChatPage from './pages/DocumentChatPage.jsx'
import DocumentAssessmentPage from './pages/DocumentAssessmentPage.jsx'
import DocumentAdaptiveRevisionPage from './pages/DocumentAdaptiveRevisionPage.jsx'
import AdaptiveQuizPage from './pages/AdaptiveQuizPage.jsx'
import ConceptDeepLearningPage from './pages/ConceptDeepLearningPage.jsx'
import KnowledgeGraphPage from './pages/KnowledgeGraphPage.jsx'
import PersonalizedLearningPathPage from './pages/PersonalizedLearningPathPage.jsx'
import ProgressAnalyticsPage from './pages/ProgressAnalyticsPage.jsx'
import SpacedRepetitionPage from './pages/SpacedRepetitionPage.jsx'
import WeakConceptRecoveryPage from './pages/WeakConceptRecoveryPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'

function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <DashboardLayout />
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<ProtectedLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="papers" element={<MyPapersPage />} />
        <Route path="analytics" element={<ProgressAnalyticsPage />} />
        <Route path="progress" element={<ProgressAnalyticsPage />} />
        <Route path="graph" element={<KnowledgeGraphPage />} />
        <Route path="knowledge-graph" element={<KnowledgeGraphPage />} />
        <Route path="quizzes" element={<AdaptiveQuizPage />} />
        <Route path="recovery" element={<WeakConceptRecoveryPage />} />
        <Route path="revision" element={<SpacedRepetitionPage />} />
        <Route path="learning-path" element={<PersonalizedLearningPathPage />} />
        <Route path="concepts/:conceptId" element={<ConceptDeepLearningPage />} />
        <Route path="papers/:documentId/analysis" element={<AnalysisPage />} />
        <Route path="papers/:documentId/learn" element={<DocumentLearningWorkspacePage />} />
        <Route path="papers/:documentId/topics/:topicId" element={<DocumentLearningWorkspacePage />} />
        <Route path="papers/:documentId/visuals" element={<VisualLearningWorkspacePage />} />
        <Route path="papers/:documentId/chat" element={<DocumentChatPage />} />
        <Route path="papers/:documentId/test" element={<DocumentAssessmentPage />} />
        <Route path="papers/:documentId/adaptive" element={<DocumentAdaptiveRevisionPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
