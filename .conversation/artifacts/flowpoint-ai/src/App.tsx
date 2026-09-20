import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import LoginPage from '@/pages/login';
import DashboardPage from '@/pages/dashboard';
import InboxPage from '@/pages/inbox';
import ContactsPage from '@/pages/contacts';
import TeamPage from '@/pages/team';
import BusinessPoliciesPage from '@/pages/business-policies';
import AgentPage from '@/pages/agent';
import PropertiesPage from '@/pages/properties';
import PropertyDetailPage from '@/pages/property-detail';
import UnitsPage from '@/pages/units';
import ServicesPage from '@/pages/services';
import RequestsPage from '@/pages/requests';
import { SettingsProvider } from '@/contexts/SettingsContext';

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LoginPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/inbox" component={InboxPage} />
      <Route path="/contacts" component={ContactsPage} />
      <Route path="/team" component={TeamPage} />
      <Route path="/business-policies" component={BusinessPoliciesPage} />
      <Route path="/agent" component={AgentPage} />
      <Route path="/properties" component={PropertiesPage} />
      <Route path="/properties/:id" component={PropertyDetailPage} />
      <Route path="/units" component={UnitsPage} />
      <Route path="/services" component={ServicesPage} />
      <Route path="/requests" component={RequestsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          {/* SettingsProvider at root so every page can read context correctly */}
          <SettingsProvider>
            <Router />
          </SettingsProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
