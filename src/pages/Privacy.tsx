import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { LegalDoc, LegalSection as S } from '@/components/legal/LegalDoc';
import { LEGAL } from '@/lib/legalConfig';

const Privacy = () => (
  <LegalDoc title="Privacy Policy" icon={<Lock className="h-5 w-5 text-primary" />}>
    <S title="1. Overview">
      <p>This policy explains what {LEGAL.serviceName} ("we", "us"), operated by {LEGAL.operator}, collects, why, who it is shared with, and the choices you have. In short: we collect only what we need to run your account and the features you use, we do not sell personal information, and we do not use advertising or analytics trackers.</p>
    </S>

    <S title="2. Information we collect">
      <p><strong className="text-foreground">Account information.</strong> Your email address and a password. Passwords are handled by our authentication provider and stored in hashed form; we never see or store your password in readable form.</p>
      <p><strong className="text-foreground">Information you enter.</strong> Portfolio holdings (symbols, buy prices, quantities, portfolio names), tracked options and futures positions, alert thresholds (target and stop levels), and daily portfolio value snapshots we record so you can see your own trend.</p>
      <p><strong className="text-foreground">Notification settings.</strong> Which alerts you turn on and, if you choose to use Slack alerts, your Slack Incoming Webhook URL. Treat that URL like a password - anyone who has it can post to that Slack channel. You can remove it in Settings at any time.</p>
      <p><strong className="text-foreground">Assistant conversations.</strong> The questions you ask the in-app assistant and its replies, saved so you can see your history.</p>
      <p><strong className="text-foreground">Technical and diagnostic data.</strong> If the app hits an error, we log the error message, the page you were on, your browser type, and your account ID if you are signed in. Error logs are deleted automatically after 30 days. Our hosting providers also keep standard server logs (such as IP address and request time) for security and operations.</p>
      <p><strong className="text-foreground">Browser storage.</strong> We use your browser's local storage - not advertising cookies - to keep you signed in, remember display preferences (such as showing the Top 50 or all stocks) and keep a local copy of options picks you track.</p>
      <p><strong className="text-foreground">What we do not collect.</strong> We do not take payments today, so we hold no card or bank details, and we do not ask for brokerage logins, account numbers or government ID numbers. Please don't enter them anywhere on the Service.</p>
    </S>

    <S title="3. How we use it">
      <ul className="ml-4 list-disc space-y-1">
        <li>to create and secure your account and provide the features you use (portfolio views, tracked picks, alerts, assistant history);</li>
        <li>to send alerts you've turned on, to the Slack channel you chose;</li>
        <li>to find and fix errors, keep the Service secure, and prevent abuse;</li>
        <li>to comply with the law and enforce our Terms.</li>
      </ul>
      <p>We do not use your holdings or conversations to build advertising profiles, and we do not use them to give you personalized investment recommendations.</p>
    </S>

    <S title="4. Who we share it with">
      <p>We use service providers to run the Service, and they process data on our behalf: <strong className="text-foreground">Supabase</strong> (database, sign-in and server functions) and <strong className="text-foreground">Vercel</strong> (website hosting). If you set up Slack alerts, alert text is sent to <strong className="text-foreground">Slack</strong> at the webhook you provide.</p>
      <p>To show prices we request quotes for stock symbols from market-data providers. Those requests contain ticker symbols only - not your name, email or account ID - although a symbol you hold may be among those requested.</p>
      <p>We may disclose information if required by law or to protect rights, safety and security, or as part of a sale or reorganization of the business (with notice if the policy would materially change). We do not sell personal information and do not share it for advertising.</p>
    </S>

    <S title="5. How long we keep it">
      <p>Account, portfolio, alert and conversation data is kept while your account is active. Error logs are deleted after 30 days, or immediately if you delete your account. When you delete your account (in Settings, or by asking us) we remove your account and the data tied to it, except where we must keep something to meet legal obligations or resolve a dispute. Backups may take a short additional time to age out.</p>
    </S>

    <S title="6. Your choices and rights">
      <ul className="ml-4 list-disc space-y-1">
        <li>You can edit or delete holdings, tracked positions and alert settings yourself in the app, and remove your Slack webhook in Settings.</li>
        <li>You can delete your account and all of its data yourself under Settings, then Delete account. This is permanent and takes effect immediately.</li>
        <li>To access or correct your data, or if you can't use Settings, email <a href={`mailto:${LEGAL.contactEmail}`} className="underline">{LEGAL.contactEmail}</a> from your account email address. We aim to respond within 30 days.</li>
        <li>Depending on where you live (for example California, other U.S. states with privacy laws, or the EU/UK), you may have additional rights, such as to know what we hold, to correct or delete it, to receive a copy, to object to or restrict certain processing, and not to be discriminated against for exercising them. Write to us and we will honor the rights that apply to you.</li>
        <li>You can clear your browser's local storage at any time; that signs you out and resets saved preferences.</li>
      </ul>
    </S>

    <S title="7. Security">
      <p>Data is encrypted in transit, and the database restricts each signed-in user to their own portfolio, tracked positions, alerts and conversations. No system is perfectly secure, so we can't guarantee absolute security. If we learn of a breach affecting you we will notify you as the law requires.</p>
    </S>

    <S title="8. Where data is processed">
      <p>The Service is operated from the United States and data is stored on servers in the United States. If you use the Service from elsewhere, you understand your information will be transferred to and processed in the United States.</p>
    </S>

    <S title="9. Children">
      <p>The Service is not for anyone under 18, and we do not knowingly collect information from children. If you believe a child has given us information, contact us and we will delete it.</p>
    </S>

    <S title="10. Changes and contact">
      <p>We may update this policy; we will post the new version with a new effective date and, for material changes, give notice in the app or by email. Questions: <a href={`mailto:${LEGAL.contactEmail}`} className="underline">{LEGAL.contactEmail}</a>. See also our <Link to="/terms" className="underline">Terms of Use</Link>.</p>
    </S>
  </LegalDoc>
);

export default Privacy;
