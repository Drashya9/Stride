import Link from "next/link";
import { contactLine, LegalPage } from "@/components/legal-page";

export const metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service">
      <p>By using Stride you agree to these terms. Stride is a free student project provided to help teams plan their work.</p>

      <section>
        <h2>Using Stride</h2>
        <ul>
          <li>You need a Google or GitHub account to sign in, and you’re responsible for activity on your account.</li>
          <li>Don’t use Stride for anything illegal, to harass others, or to upload content you don’t have the right to share.</li>
          <li>Don’t try to access workspaces you haven’t been invited to or disrupt the service.</li>
        </ul>
      </section>

      <section>
        <h2>Your content</h2>
        <p>
          You own what you put in Stride. You give Stride permission to store and display it to the members of your workspace so
          the service can work.
        </p>
      </section>

      <section>
        <h2>No warranty</h2>
        <p>
          Stride is provided “as is”, without guarantees of availability or that data will never be lost. Keep your own copies
          of anything important. Features may change, and the service may be paused or shut down.
        </p>
      </section>

      <section>
        <h2>Ending use</h2>
        <p>You can stop using Stride at any time. We may suspend accounts that break these terms.</p>
      </section>

      <section>
        <h2>Privacy</h2>
        <p>
          See the{" "}
          <Link href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </Link>{" "}
          for what data Stride collects and how it’s used.
        </p>
      </section>

      <section>
        <h2>Contact</h2>
        <p>Questions: {contactLine()}.</p>
      </section>
    </LegalPage>
  );
}
