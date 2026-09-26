import { contactLine, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        Stride is a project tracker for student teams. This page explains what information Stride collects, why, and what
        choices you have. Stride is a student project and is not operated by a company.
      </p>

      <section>
        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Account information from Google or GitHub sign-in:</strong> your name, email address and profile picture.
            We never see or store your Google or GitHub password.
          </li>
          <li>
            <strong>Content you create:</strong> workspaces, issues, comments, labels, and invites you send (including the
            invitee’s email address).
          </li>
          <li>
            <strong>Activity history:</strong> a log of changes (who changed what, and when) so teams can see history and undo
            mistakes.
          </li>
          <li>
            <strong>Performance timings:</strong> anonymous measurements such as how long an action took to appear on screen,
            used only to make Stride faster.
          </li>
          <li>
            <strong>GitHub pull request details</strong> (title, number, link) if a workspace admin connects a repository.
          </li>
        </ul>
      </section>

      <section>
        <h2>How we use it</h2>
        <ul>
          <li>To sign you in and show you the workspaces you belong to.</li>
          <li>To let teammates see and collaborate on the same issues.</li>
          <li>To send invite emails when a workspace admin invites someone.</li>
          <li>To measure and improve Stride’s speed and reliability.</li>
        </ul>
        <p className="mt-2">We do not sell your data, show ads, or share it with anyone for marketing.</p>
      </section>

      <section>
        <h2>Google user data</h2>
        <p>
          When you sign in with Google, Stride requests only your basic profile (name, email address, profile picture) to create
          and identify your account. Stride does not access your Gmail, Drive, Calendar or any other Google data. Stride’s use of
          information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use
          requirements.
        </p>
      </section>

      <section>
        <h2>Where data is stored</h2>
        <p>
          Stride runs on Vercel (hosting) and stores data in a Neon PostgreSQL database in the United States. Invite emails are
          sent through Gmail or Resend. These providers process data only to run the service.
        </p>
      </section>

      <section>
        <h2>Who can see your data</h2>
        <p>
          Content in a workspace is visible to that workspace’s members. Your name, email and picture are visible to people in
          workspaces you join. Workspace admins can change roles and remove members.
        </p>
      </section>

      <section>
        <h2>Keeping and deleting data</h2>
        <p>
          Data is kept while your account or workspace is in use. You can leave a workspace at any time from its Settings page.
          To delete your account and its data, contact us and we will remove it.
        </p>
      </section>

      <section>
        <h2>Cookies</h2>
        <p>Stride uses a single sign-in cookie to keep you logged in, and stores small preferences (like hidden tips) in your browser. No tracking or advertising cookies.</p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions or deletion requests: {contactLine()}.</p>
      </section>
    </LegalPage>
  );
}
