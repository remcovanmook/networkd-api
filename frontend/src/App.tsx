import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SchemaProvider } from './contexts/SchemaContext';
import { ToastProvider } from './components/ToastContext';
import { HostProvider } from './contexts/HostContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import EditNetwork from './pages/EditNetwork';
import EditLink from './pages/EditLink';
import EditNetDev from './pages/EditNetDev';
import SystemPage from './pages/SystemPage';
import ApiDocs from './pages/ApiDocs';
import SchemaEditor from './pages/SchemaEditor';
import WelcomePage from './pages/WelcomePage';
import HostManagementPage from './pages/HostManagementPage';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <HostProvider> {/* Added HostProvider */}
          <SchemaProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<WelcomePage />} />
                  <Route path="configuration" element={<Dashboard />} />

                  {/* Specific Editors */}
                  <Route path="link/new" element={<EditLink />} />
                  <Route path="link/:filename" element={<EditLink />} />

                  <Route path="netdev/new" element={<EditNetDev />} />
                  <Route path="netdev/:filename" element={<EditNetDev />} />

                  <Route path="network/new" element={<EditNetwork />} />
                  <Route path="network/:filename" element={<EditNetwork />} />

                  <Route path="system" element={<SystemPage />} />
                  <Route path="hosts" element={<HostManagementPage />} />
                  <Route path="preferences" element={<SchemaEditor />} />
                  <Route path="api-docs" element={<ApiDocs />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SchemaProvider>
        </HostProvider> {/* Closed HostProvider */}
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;

