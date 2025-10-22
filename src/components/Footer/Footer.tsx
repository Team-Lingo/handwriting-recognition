"use client";
import Image from "next/image";
import Link from "next/link";
import { FaFacebookF, FaTwitter, FaLinkedinIn } from "react-icons/fa";
import "./Footer.css";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer section" aria-labelledby="footer-heading">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Link href="/" className="brand-link" aria-label="Lingo home">
            <Image
              src="/Images/logo2.png"
              alt="Lingo logo"
              width={180}
              height={48}
              className="brand-logo"
              priority
            />
          </Link>
          <p className="brand-tagline">
            Advanced handwriting
            <br /> recognition powered by AI
          </p>
          <div className="social">
            <Link href="#" aria-label="Facebook" className="social-link">
              <FaFacebookF />
            </Link>
            <Link href="#" aria-label="Twitter" className="social-link">
              <FaTwitter />
            </Link>
            <Link href="#" aria-label="LinkedIn" className="social-link">
              <FaLinkedinIn />
            </Link>
          </div>
        </div>

        <nav className="footer-cols" aria-label="Footer">
          <div className="footer-col">
            <h4 className="col-title">Product</h4>
            <ul role="list" className="col-list">
              <li>
                <Link href="/features">Features</Link>
              </li>
              <li>
                <Link href="/pricing">Pricing</Link>
              </li>
              <li>
                <Link href="/solutions">Solutions</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="col-title">Company</h4>
            <ul role="list" className="col-list">
              <li>
                <Link href="/about">About</Link>
              </li>
              <li>
                <Link href="/contact">Contact</Link>
              </li>
              <li>
                <Link href="/careers">Careers</Link>
              </li>
            </ul>
          </div>
          <div className="footer-col">
            <h4 className="col-title">Legal</h4>
            <ul role="list" className="col-list">
              <li>
                <Link href="/privacy">Privacy</Link>
              </li>
              <li>
                <Link href="/terms">Terms</Link>
              </li>
              <li>
                <Link href="/security">Security</Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className="footer-bottom">
        <div className="container footer-bottom-inner">
          <hr className="footer-divider" />
          <small className="copyright">
            © {year} Lingo. All rights reserved.
          </small>
        </div>
      </div>
    </footer>
  );
}
