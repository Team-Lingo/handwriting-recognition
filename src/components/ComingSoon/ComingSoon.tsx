"use client";

import "./ComingSoon.css";
import { useRouter } from "next/navigation";

export default function ComingSoon() {
  const router = useRouter();
  return (
    <section className="Container">
      <span className="Badge">🚧 Coming Soon</span>
      <h1 className={`landing-title Title`}>
        This feature is under construction
      </h1>
      <p className="Subtitle">
        We&apos;re working hard to bring this to you. In the meantime, you can
        use the existing features or return to the dashboard.
      </p>
      <button className="Cta" onClick={() => router.push("/landing")}>
        Go home
      </button>
    </section>
  );
}
