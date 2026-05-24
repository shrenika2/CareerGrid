import { useState } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import StudentNavbar from '../components/navbars/StudentNavbar';

import StudentDashboard from '../pages/StudentDashboard';
import DashboardOverview from '../features/dashboard/DashboardOverview';
import ProfilePage from '../features/profile/ProfilePage';
import TeamHub from '../features/team/TeamHub';
import ExperienceWall from '../features/experience/ExperienceWall';
import GuidanceHub from '../pages/GuidanceHub';
import Opportunities from '../pages/Opportunities';
import OpportunityDetail from '../pages/OpportunityDetail';
import Community from '../pages/Community';
import NotificationHistory from '../pages/NotificationHistory';
import PracticeResources from '../pages/PracticeResources';
import PracticeArena from '../pages/PracticeArena';
import InterviewPipeline from '../pages/InterviewPipeline';
import StudentWorkspace from '../features/workspace/pages/StudentWorkspace';

// Mock Interview Views (Existing)
import SkillInput from '../pages/mock-interview/SkillInput';
import Interview from '../pages/mock-interview/Interview';
import Results from '../pages/mock-interview/Results';

// New Real-Time AI Interview Components
import SetupScreen from '../components/SetupScreen';
import MockInterviewer from '../components/MockInterviewer';

const StudentLayout = () => (
    <>
        <StudentNavbar />
        <div className="min-h-screen bg-slate-950">
            <Outlet />
        </div>
    </>
);

// New Wrapper Component for the Real-Time Interview Feature
const LiveInterviewContainer = () => {
    const location = useLocation();
    const [sessionId, setSessionId] = useState(location.state?.sessionId || null);

    if (!sessionId) {
        return <SetupScreen onSetupComplete={setSessionId} />;
    }

    return <MockInterviewer sessionId={sessionId} />;
};

const StudentRoutes = () => {
    return (
        <Routes>
            <Route element={<StudentLayout />}>
                <Route path="dashboard" element={<StudentDashboard />}>
                    <Route index element={<Navigate to="overview" replace />} />
                    <Route path="overview" element={<DashboardOverview />} />
                    <Route path="profile" element={<ProfilePage />} />
                    <Route path="team" element={<TeamHub />} />
                    <Route path="experience" element={<ExperienceWall />} />
                    <Route path="guidance" element={<GuidanceHub />} />
                </Route>
                <Route path="opportunities" element={<Opportunities />} />
                <Route path="opportunities/:id" element={<OpportunityDetail />} />
                <Route path="community" element={<Community />} />
                <Route path="notifications" element={<NotificationHistory />} />
                <Route path="practice" element={<PracticeResources />} />
                <Route path="arena/:companyId" element={<PracticeArena />} />
                <Route path="interview-pipeline" element={<InterviewPipeline />} />
                <Route path="workspace" element={<StudentWorkspace />} />

                {/* AI Mock Interview Module (Existing) */}
                <Route path="mock-interview/setup" element={<SkillInput />} />
                <Route path="mock-interview/live" element={<Interview />} />
                <Route path="mock-interview/results/:id" element={<Results />} />

                {/* New Real-Time Context-Aware AI Interview */}
                <Route path="live-interview" element={<LiveInterviewContainer />} />

                <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
            </Route>
        </Routes>
    );
};

export default StudentRoutes;
