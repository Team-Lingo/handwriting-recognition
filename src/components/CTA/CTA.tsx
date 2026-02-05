import "./CTA.css"
export default function CTASection() {
  return (
    <section className="CTA">
      <div className="CTA-content">
        <div className="icon">
          <img src="/Images/Quill.svg" alt="feather icon" />
        </div>

        <h1>Ready to Transform Your Handwriting?</h1>

        <p>
          Join thousands of users who trust Lingo for accurate handwriting
          recognition
        </p>

        <button className="cta-btn">Start Free Trial</button>
      </div>
    </section>
  );
}
