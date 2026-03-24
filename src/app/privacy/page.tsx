export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui" }}>
      <h1>Privacy Policy</h1>
      <p><strong>Sakhiyaan</strong> — Last updated: March 23, 2026</p>

      <h2>What We Collect</h2>
      <p>
        When you interact with Sakhiyaan via Instagram, Telegram, or our website, we may collect:
        messages you send, photos you share for skin analysis, and basic profile information
        (username, profile ID) provided by the platform.
      </p>

      <h2>How We Use It</h2>
      <p>
        Your data is used solely to provide personalized skincare advice and analysis.
        We do not sell or share your personal data with third parties.
      </p>

      <h2>Data Storage</h2>
      <p>
        Your data is stored securely on encrypted servers. Photos uploaded for skin analysis
        are stored on Vercel Blob storage with restricted access.
      </p>

      <h2>Data Deletion</h2>
      <p>
        You can request deletion of your data at any time by contacting us at{" "}
        <a href="mailto:pulkitwalia099@gmail.com">pulkitwalia099@gmail.com</a>.
      </p>

      <h2>Contact</h2>
      <p>
        For any privacy-related questions, email{" "}
        <a href="mailto:pulkitwalia099@gmail.com">pulkitwalia099@gmail.com</a>.
      </p>
    </div>
  );
}
