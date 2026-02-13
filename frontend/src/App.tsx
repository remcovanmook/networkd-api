import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SchemaProvider } from './contexts/SchemaContext';
import { ToastProvider } from './components/ToastContext';
import { HostProvider } from './contexts/HostContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ConfigEditor from './pages/ConfigEditor';
import SystemPage from './pages/SystemPage';
import ApiDocs from './pages/ApiDocs';
import WelcomePage from './pages/WelcomePage';
import HostManagementPage from './pages/HostManagementPage';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <HostProvider>
          <SchemaProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Layout />}>
                  <Route index element={<WelcomePage />} />
                  <Route path="configuration" element={<Dashboard />} />

                  <Route path="network/new" element={<ConfigEditor configType="network" />} />
                  <Route path="network/:filename" element={<ConfigEditor configType="network" />} />

                  <Route path="netdev/new" element={<ConfigEditor configType="netdev" />} />
                  <Route path="netdev/:filename" element={<ConfigEditor configType="netdev" />} />

                  <Route path="link/new" element={<ConfigEditor configType="link" />} />
                  <Route path="link/:filename" element={<ConfigEditor configType="link" />} />

                  <Route path="system" element={<SystemPage />} />
                  <Route path="hosts" element={<HostManagementPage />} />
                  <Route path="api-docs" element={<ApiDocs />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </SchemaProvider>
        </HostProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
};

export default App;

