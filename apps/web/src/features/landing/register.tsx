import { isPaymentEnabled, SRM_EMAIL_DOMAIN, TEAM_SIZE, UPLOADS } from "@pandora/core";
import { OrnamentFrame } from "@pandora/ui";
import { RegistrationSection } from "../registration/registration-section";
import styles from "./landing.module.css";

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

/** "Register your team for MSA Pandora": the registration form in a framed card beside the notes to read first. */
export function Register() {
  const paymentEnabled = isPaymentEnabled(process.env.PAYMENT_ENABLED);

  return (
    <section id="register" className={styles.register} aria-labelledby="register-title">
      <div className={styles.registerBg} aria-hidden="true" />
      <div className={styles.registerInner}>
        <p className={styles.registerKicker}>let&rsquo;s get you geared up:</p>
        <h2 id="register-title" className={styles.registerTitle}>
          Register your team for <span className={styles.registerMark}>MSA Pandora</span>
        </h2>

        <OrnamentFrame cornerSize={50} inset={12} style={{ background: "var(--pandora-paper)", borderRadius: 24 }}>
          <div className={styles.registerCard}>
            <div className={styles.registerForm}>
              <RegistrationSection />
            </div>
            <aside className={styles.registerNotes} aria-labelledby="register-notes-title">
              <h3 id="register-notes-title" className={styles.registerNotesTitle}>
                Things to note while registering
              </h3>
              <ul className={styles.registerNotesList}>
                <li>
                  A team has {TEAM_SIZE.min} to {TEAM_SIZE.max} members. Member {TEAM_SIZE.max} is optional.
                </li>
                <li>
                  The team leader&rsquo;s SRM email (@{SRM_EMAIL_DOMAIN}) is checked with a one-time code before you can
                  continue.
                </li>
                <li>
                  Every member needs an SRM email, a registration number and a photo (JPG, PNG or WebP, up to{" "}
                  {megabytes(UPLOADS.photo.maxBytes)} MB).
                </li>
                {paymentEnabled ? (
                  <li>
                    Registration is paid per team. You upload the payment proof (JPG or PNG, up to{" "}
                    {megabytes(UPLOADS.paymentProof.maxBytes)} MB) in the last step, and an admin approves it.
                  </li>
                ) : null}
                <li>Your answers are saved on this device, so you can leave and pick up where you stopped.</li>
                <li>When you finish, a confirmation goes to every member&rsquo;s SRM email.</li>
              </ul>
            </aside>
          </div>
        </OrnamentFrame>
      </div>
    </section>
  );
}
