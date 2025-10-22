"use client";
import { useState } from "react";
import {
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaLinkedinIn,
} from "react-icons/fa";
import { Phone, Mail, MapPin } from "lucide-react";
import "./Contact.css";

export default function Contact() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
    console.log("Form submitted:", formData);
  };

  return (
    <section className="section contact-section" id="contact">
      <div className="container contact-wrapper">
        <div className="contact-left">
          <h2 className="contact-title">Connect with the Lingo Team</h2>
          <p className="contact-subtitle">
            Fill up the form and our Team will get back to you within 24 hours.
          </p>

          <div className="contact-info">
            <div className="contact-item">
              <Phone className="contact-icon" size={20} />
              <span>+01273564747</span>
            </div>
            <div className="contact-item">
              <Mail className="contact-icon" size={20} />
              <span>hello@gmail.com</span>
            </div>
            <div className="contact-item">
              <MapPin className="contact-icon" size={20} />
              <span>19 thabet street</span>
            </div>
          </div>

          <div className="contact-social">
            <a href="#" aria-label="Facebook" className="contact-social-link">
              <FaFacebookF />
            </a>
            <a href="#" aria-label="Twitter" className="contact-social-link">
              <FaTwitter />
            </a>
            <a href="#" aria-label="Instagram" className="contact-social-link">
              <FaInstagram />
            </a>
            <a href="#" aria-label="LinkedIn" className="contact-social-link">
              <FaLinkedinIn />
            </a>
          </div>

          <div className="decorative-circle decorative-circle-1"></div>
          <div className="decorative-circle decorative-circle-2"></div>
        </div>

        <div className="contact-right">
          <h3 className="form-title">
            Whether it&apos;s feedback, support, or collaboration — let&apos;s
            start the conversation.
          </h3>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Your Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Your Email</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Message</label>
              <textarea
                id="message"
                name="message"
                rows={5}
                placeholder="Write your message"
                value={formData.message}
                onChange={handleChange}
                required
              ></textarea>
            </div>

            <button type="submit" className="submit-btn">
              Send Message
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
