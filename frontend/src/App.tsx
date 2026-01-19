import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EditNetwork from './pages/EditNetwork';
import SystemPage from './pages/SystemPage';
import ApiDocs from './pages/ApiDocs';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="interfaces" element={<Dashboard />} />
            <Route path="interfaces/new" element={<EditNetwork />} />
            <Route path="interfaces/:filename" element={<EditNetwork />} />
            <Route path="networks/:filename" element={<EditNetwork />} />
            <Route path="system" element={<SystemPage />} />
            <Route path="api-docs" element={<ApiDocs />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
