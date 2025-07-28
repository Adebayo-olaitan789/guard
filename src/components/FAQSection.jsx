import { useState } from 'react';

function FAQSection() {
  const faqs = [
    { question: "What is a common scam?", answer: "Phishing emails that trick you into giving personal information." },
    { question: "How can I report a scam?", answer: "Report to the FTC at ReportFraud.ftc.gov." },
    { question: "How to spot a scam?", answer: "Look for unsolicited requests, urgent demands, or suspicious links." }
  ];

  return (
    <div className="my-5">
      <h2>Frequently Asked Questions</h2>
      <div className="accordion" id="faqAccordion">
        {faqs.map((faq, index) => (
          <div className="accordion-item" key={index}>
            <h2 className="accordion-header" id={`heading${index}`}>
              <button
                className="accordion-button"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target={`#collapse${index}`}
                aria-expanded={index === 0 ? "true" : "false"}
                aria-controls={`collapse${index}`}
              >
                {faq.question}
              </button>
            </h2>
            <div
              id={`collapse${index}`}
              className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`}
              aria-labelledby={`heading${index}`}
              data-bs-parent="#faqAccordion"
            >
              <div className="accordion-body">{faq.answer}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default FAQSection;