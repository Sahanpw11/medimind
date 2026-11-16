import { Download, LogOut, Share } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useInstall } from '../lib/pwa';
import { Avatar, Banner, Button, Card, Screen } from '../components/ui';

export default function Account() {
  const { user, logout } = useAuth();
  const pwa = useInstall();
  return (
    <Screen title="Account">
      <div className="cols">
        <div className="s5 stack lg">
          <Card title="Signed in as">
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}><Avatar name={user!.email.split('@')[0]} large /><div><b style={{ overflowWrap: 'anywhere' }}>{user!.email}</b><p style={{ color: 'var(--ink-2)', textTransform: 'capitalize' }}>{user!.role}</p></div></div>
          </Card>
          <div className="stack">
            {pwa.canInstall && <Button variant="secondary" onClick={pwa.install}><Download className="icon" aria-hidden />Install MediMind</Button>}
            {pwa.iosHint && <Banner><Share className="icon" aria-hidden /> To install on iPhone, tap Share, then Add to Home Screen.</Banner>}
            <Button variant="danger" onClick={() => void logout()}><LogOut className="icon" aria-hidden />Sign out</Button>
            <p className="group-foot" style={{ padding: 0 }}>MediMind is an educational prototype. It uses synthetic data, is not clinically validated and does not give medical advice.</p>
          </div>
        </div>
      </div>
    </Screen>
  );
}
