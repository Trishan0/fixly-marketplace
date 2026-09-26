import React from 'react'
import { Link } from 'react-router-dom'
import { FileText, LifeBuoy, ShieldCheck } from 'lucide-react'
import { PublicNavbar } from '../../components/shared/PublicNavbar'
import { PublicFooter } from '../../components/shared/PublicFooter'
import { usePageTitle } from '../../hooks/usePageTitle'

const LAST_UPDATED = '26 September 2026'

function LegalLayout({ icon: Icon, eyebrow, title, intro, sections }) {
  usePageTitle(title)
  return (
    <div className="fixly-page-shell min-h-[100dvh] overflow-x-hidden">
      <PublicNavbar />
      <main id="main-content">
        <header className="border-b border-slate-100 py-12 dark:border-slate-800 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-card bg-sky-50 text-sky-700 dark:bg-sky-950/45 dark:text-sky-300">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <p className="text-sm font-semibold text-sky-700 dark:text-sky-300">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">{intro}</p>
            <p className="mt-4 text-sm text-slate-500">Last updated {LAST_UPDATED}</p>
          </div>
        </header>

        <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
          <nav aria-label="On this page" className="hidden lg:block">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</p>
            <ol className="sticky top-24 mt-3 space-y-2 text-sm">
              {sections.map(section => (
                <li key={section.id}>
                  <a href={`#${section.id}`} className="text-slate-600 hover:text-sky-700 dark:text-slate-300 dark:hover:text-sky-300">{section.title}</a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="max-w-3xl space-y-10">
            {sections.map(section => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <h2 className="text-xl font-bold text-slate-950">{section.title}</h2>
                <div className="mt-3 space-y-3 text-[15px] leading-7 text-slate-600 dark:text-slate-300">{section.body}</div>
              </section>
            ))}
            <section className="rounded-card border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              Questions about this page? <Link to="/contact" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">Contact the Fixly team</Link> and we will reply by email.
            </section>
          </article>
        </div>
      </main>
      <PublicFooter />
    </div>
  )
}

function List({ items }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5">
      {items.map(item => <li key={typeof item === 'string' ? item : item.key}>{item}</li>)}
    </ul>
  )
}

export function TermsPage() {
  return (
    <LegalLayout
      icon={FileText}
      eyebrow="Legal"
      title="Terms of Service"
      intro="These terms explain how Fixly works, what we expect from customers and workers, and what Fixly is and isn't responsible for. By creating an account you agree to them."
      sections={[
        {
          id: 'what-fixly-is',
          title: 'What Fixly is',
          body: (
            <>
              <p>Fixly is an online marketplace that helps customers in Sri Lanka find independent service workers, such as plumbers, electricians, carpenters and cleaners, and helps those workers find jobs.</p>
              <p>Fixly is not an employer, agent or contractor of any worker. Workers are independent. The agreement for a job, including its scope, price, timing and quality, is between the customer and the worker who accepts it.</p>
            </>
          ),
        },
        {
          id: 'accounts',
          title: 'Your account',
          body: (
            <List items={[
              'You must be at least 18 years old and able to enter a binding agreement.',
              'Give accurate information and keep it up to date. Don’t create an account for someone else or impersonate anyone.',
              'Keep your password private. You are responsible for activity on your account.',
              'Customers must verify their email address before posting jobs.',
            ]} />
          ),
        },
        {
          id: 'customers',
          title: 'If you hire on Fixly',
          body: (
            <List items={[
              'Describe the job honestly, including the location, the problem and any safety hazards.',
              'Only post real jobs you intend to have done.',
              'When you accept a proposal, the worker is hired for that job and can see your contact number.',
              'Pay the worker the agreed amount and record the payment in Fixly so both of you have a record.',
              'Leave reviews that are honest and about the work you received.',
            ]} />
          ),
        },
        {
          id: 'workers',
          title: 'If you work on Fixly',
          body: (
            <List items={[
              'Only offer services you are qualified, licensed (where required) and equipped to do safely.',
              'Quote honestly. If you need to inspect the site before pricing, say so.',
              'Arrive when agreed, do the work to a reasonable standard and keep the customer informed.',
              'Confirm or dispute recorded payments promptly and truthfully.',
              'Any NIC you upload must be your own, current and unaltered.',
            ]} />
          ),
        },
        {
          id: 'payments',
          title: 'Payments',
          body: (
            <>
              <p>Fixly does not currently process payments. Customers pay workers directly, for example in cash or by bank transfer, and record the payment in Fixly. Fixly does not hold funds and is not responsible for payments made outside the platform.</p>
              <p>If a worker disputes a recorded payment, both parties should try to resolve it directly. Fixly may review the job history and contact both parties, but cannot guarantee recovery of money.</p>
            </>
          ),
        },
        {
          id: 'ai',
          title: 'AI features',
          body: (
            <p>Fixly offers optional AI tools that suggest workers for a job and draft proposals. Suggestions are a starting point, not advice or a guarantee of quality. Nothing is sent on your behalf until you review and confirm it. Workers can opt out of AI matching in Settings.</p>
          ),
        },
        {
          id: 'not-allowed',
          title: 'What isn’t allowed',
          body: (
            <List items={[
              'Illegal, dangerous or discriminatory jobs or services.',
              'Harassment, threats, hate speech or sexual content.',
              'Fake reviews, fake jobs, spam, or attempts to manipulate ratings or AI matching.',
              'Collecting other users’ personal information for purposes unrelated to a job.',
              'Interfering with or trying to gain unauthorised access to Fixly.',
            ]} />
          ),
        },
        {
          id: 'moderation',
          title: 'Reports, suspension and closure',
          body: (
            <p>We may remove content, reject identity documents, or suspend or close accounts that break these terms or put others at risk. Where we can, we will tell you why. You can stop using Fixly at any time and ask us to close your account from the Contact page.</p>
          ),
        },
        {
          id: 'liability',
          title: 'Responsibility and liability',
          body: (
            <>
              <p>Fixly checks some information, such as email addresses and, where a worker chooses to submit one, their NIC. A verified badge means we reviewed the document; it is not a guarantee of a worker’s skills, conduct or insurance.</p>
              <p>To the extent the law allows, Fixly is not liable for the work performed, for loss or damage arising from a job, or for disputes between users. Nothing in these terms limits rights you have under Sri Lankan consumer protection law.</p>
            </>
          ),
        },
        {
          id: 'changes',
          title: 'Changes and governing law',
          body: (
            <p>We may update these terms. If a change is significant, we will tell you in the app or by email before it takes effect. These terms are governed by the laws of Sri Lanka.</p>
          ),
        },
      ]}
    />
  )
}

export function PrivacyPage() {
  return (
    <LegalLayout
      icon={ShieldCheck}
      eyebrow="Legal"
      title="Privacy Policy"
      intro="This policy explains what personal data Fixly collects, why, who we share it with and the choices you have. We process personal data in line with Sri Lanka’s Personal Data Protection Act, No. 9 of 2022."
      sections={[
        {
          id: 'what-we-collect',
          title: 'What we collect',
          body: (
            <List items={[
              'Account details: your name, email address, password (stored only as a secure hash), role, phone number, district and area.',
              'Profile details: profile photo; for workers, bio, skills, starting price and portfolio photos.',
              'Identity documents: if a worker chooses to verify their identity, a photo of their National Identity Card (NIC).',
              'Marketplace activity: jobs, job photos and addresses, proposals, invitations, agreed prices, recorded payments, reviews, reports and notifications.',
              'Messages you send us through the Contact form.',
              'Technical data: your browser stores your sign-in token, display preferences (such as dark mode) and any job draft on your device. Our servers keep basic request logs for security.',
              'Usage and error data: which pages and features are used (for example “job posted” or “proposal sent”) and technical details when something breaks. These are linked to your account ID and role only — not your name, email or phone number — and the pages recorded never include which job or person you viewed.',
            ]} />
          ),
        },
        {
          id: 'why',
          title: 'Why we use it',
          body: (
            <List items={[
              'To run the marketplace: showing profiles and jobs, sending proposals and invitations, and keeping a record of each job.',
              'To build trust and safety: verifying emails and identity documents, investigating reports and disputes, and preventing abuse.',
              'To send you service messages, such as verification emails, password resets and job notifications.',
              'To provide optional AI matching and proposal drafting (see below).',
              'To meet legal obligations.',
            ]} />
          ),
        },
        {
          id: 'who-sees-what',
          title: 'Who can see your information',
          body: (
            <List items={[
              'Worker profiles (name, photo, skills, district, bio, portfolio, ratings and reviews) are public.',
              'Customer profiles are visible only to signed-in Fixly users.',
              'Phone numbers stay masked until a worker is hired for a job; then the customer and that worker can see each other’s number.',
              'NIC images are stored privately and are only visible to Fixly administrators reviewing them. They are never shown on your profile.',
            ]} />
          ),
        },
        {
          id: 'ai',
          title: 'AI features and Google Gemini',
          body: (
            <>
              <p>When a customer runs AI matching, or a worker asks for AI job suggestions or a draft proposal, the relevant job details and worker profile information (skills, bio, district, ratings and review text) are sent to Google’s Gemini service to produce the result. We automatically remove phone numbers, email addresses and NIC numbers from this text first. That filter can miss details written in unusual ways, so please don’t put contact details in job descriptions, bios or reviews.</p>
              <p>Workers can turn off AI matching at any time in Settings. You will then not be included in AI recommendations.</p>
            </>
          ),
        },
        {
          id: 'processors',
          title: 'Service providers',
          body: (
            <p>We use trusted providers to host the app and database, store uploaded files, send email, provide AI features, measure how the product is used (PostHog), and report errors (Sentry). They process data only on our instructions. Some providers may store data outside Sri Lanka; where they do, we rely on safeguards permitted by law. Usage measurement respects your browser’s “Do Not Track” setting.</p>
          ),
        },
        {
          id: 'retention',
          title: 'How long we keep data',
          body: (
            <List items={[
              'Account and job records: while your account is open, and for a limited period afterwards where needed to resolve disputes or meet legal obligations.',
              'NIC images: deleted when a document is rejected, and when you ask us to remove it or close your account.',
              'Contact form messages: as long as needed to respond.',
            ]} />
          ),
        },
        {
          id: 'your-rights',
          title: 'Your rights',
          body: (
            <>
              <p>You can ask to access, correct or delete your personal data, withdraw consent (for example to AI matching), or object to certain processing. You can edit most details yourself in Edit profile and Settings.</p>
              <p>For anything else, <Link to="/contact" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">contact us</Link>. We will respond within the time required by law. If you are unhappy with our response, you can complain to the Data Protection Authority of Sri Lanka.</p>
            </>
          ),
        },
        {
          id: 'security',
          title: 'Security',
          body: (
            <p>We use encrypted connections, hashed passwords, private storage for identity documents, and access controls for administrators. No system is perfectly secure; if we become aware of a breach affecting you, we will notify you as the law requires.</p>
          ),
        },
        {
          id: 'children',
          title: 'Children',
          body: <p>Fixly is not intended for anyone under 18, and we do not knowingly collect their data.</p>,
        },
      ]}
    />
  )
}

export function SafetyPage() {
  return (
    <LegalLayout
      icon={LifeBuoy}
      eyebrow="Trust & safety"
      title="Staying safe on Fixly"
      intro="Most jobs go smoothly. These simple habits help keep it that way for customers and workers."
      sections={[
        {
          id: 'before-hiring',
          title: 'Before you hire',
          body: (
            <List items={[
              'Read the worker’s profile, reviews and portfolio. Look for the verified badge, but still use your judgement.',
              'Compare a few proposals. Be cautious of prices that seem far too low.',
              'Agree the scope, price and timing before work starts, and record the agreed price in Fixly.',
            ]} />
          ),
        },
        {
          id: 'on-the-day',
          title: 'On the day',
          body: (
            <List items={[
              'If possible, have someone else at home, especially for a first visit.',
              'Keep valuables and documents out of the work area.',
              'Workers: tell someone where you are going, and leave if you feel unsafe.',
            ]} />
          ),
        },
        {
          id: 'payments',
          title: 'Payments',
          body: (
            <List items={[
              'Avoid paying the full amount in advance. A deposit for materials is reasonable; agree it in writing.',
              'Record every payment in Fixly, and keep receipts for bank transfers.',
              'Workers: confirm payments you receive, and dispute a payment only if the amount is wrong or wasn’t received.',
            ]} />
          ),
        },
        {
          id: 'red-flags',
          title: 'Red flags',
          body: (
            <List items={[
              'Pressure to move the conversation or payment off Fixly straight away.',
              'Requests for your NIC number, bank passwords or one-time codes.',
              'A job or profile that doesn’t match what you see in person.',
            ]} />
          ),
        },
        {
          id: 'get-help',
          title: 'If something goes wrong',
          body: (
            <>
              <p>If anyone is in immediate danger, call the Sri Lanka Police emergency line on <a href="tel:119" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">119</a> first.</p>
              <p>For problems with a job, a payment or another user, <Link to="/contact" className="font-semibold text-sky-700 underline underline-offset-2 dark:text-sky-300">contact the Fixly team</Link> with the job title and what happened. We review every report.</p>
            </>
          ),
        },
      ]}
    />
  )
}
