import { Link } from 'react-router-dom';
import './Legal.css';

function Helplines() {
  return (
    <div className="legal-page">
      <div className="legal-header">
        <h1>🌈 Global Crisis Helplines</h1>
        <p className="legal-subtitle">24/7 Support Resources Worldwide</p>
      </div>

      <div className="legal-content">
        <div className="emergency-banner" style={{
          background: 'var(--soft-lavender)',
          border: '2px solid var(--pryde-purple)',
          borderRadius: '8px',
          padding: '1.5rem',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: 'var(--pryde-purple)', marginTop: 0 }}>⚠️ Emergency Services</h2>
          <p>
            <strong>If you are in immediate danger, call emergency services:</strong>
          </p>
          <ul>
            <li><strong>Australia:</strong> 000</li>
            <li><strong>United States:</strong> 911</li>
            <li><strong>United Kingdom:</strong> 999</li>
            <li><strong>European Union:</strong> 112</li>
            <li><strong>New Zealand:</strong> 111</li>
            <li><strong>Canada:</strong> 911</li>
          </ul>
        </div>

        <section className="legal-section">
          <h2>🇦🇺 Australia</h2>
          
          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Lifeline:</strong> 13 11 14 | <a href="https://www.lifeline.org.au" target="_blank" rel="noopener noreferrer">lifeline.org.au</a> (24/7 crisis support & suicide prevention)</li>
            <li><strong>Beyond Blue:</strong> 1300 22 4636 | <a href="https://www.beyondblue.org.au" target="_blank" rel="noopener noreferrer">beyondblue.org.au</a> (24/7 mental health support)</li>
            <li><strong>Suicide Call Back Service:</strong> 1300 659 467 | <a href="https://www.suicidecallbackservice.org.au" target="_blank" rel="noopener noreferrer">suicidecallbackservice.org.au</a> (24/7)</li>
            <li><strong>Kids Helpline:</strong> 1800 55 1800 | <a href="https://kidshelpline.com.au" target="_blank" rel="noopener noreferrer">kidshelpline.com.au</a> (ages 5-25, 24/7)</li>
            <li><strong>MensLine Australia:</strong> 1300 78 99 78 | <a href="https://mensline.org.au" target="_blank" rel="noopener noreferrer">mensline.org.au</a> (24/7 support for men)</li>
          </ul>

          <h3>LGBTQ+ Support (Australia)</h3>
          <ul>
            <li><strong>QLife:</strong> 1800 184 527 | <a href="https://qlife.org.au" target="_blank" rel="noopener noreferrer">qlife.org.au</a> (LGBTIQ+ peer support, 3pm-midnight daily)</li>
            <li><strong>Switchboard Victoria:</strong> 1800 184 527 | <a href="https://switchboard.org.au" target="_blank" rel="noopener noreferrer">switchboard.org.au</a> (LGBTIQ+ support)</li>
            <li><strong>Transgender Victoria:</strong> (03) 9020 4675 | <a href="https://transgendervictoria.com" target="_blank" rel="noopener noreferrer">transgendervictoria.com</a></li>
            <li><strong>ACON (NSW):</strong> (02) 9206 2000 | <a href="https://www.acon.org.au" target="_blank" rel="noopener noreferrer">acon.org.au</a></li>
            <li><strong>Minus18:</strong> <a href="https://www.minus18.org.au" target="_blank" rel="noopener noreferrer">minus18.org.au</a> (LGBTIQ+ youth support)</li>
          </ul>

          <h3>Domestic Violence & Sexual Assault (Australia)</h3>
          <ul>
            <li><strong>1800RESPECT:</strong> 1800 737 732 | <a href="https://www.1800respect.org.au" target="_blank" rel="noopener noreferrer">1800respect.org.au</a> (24/7 domestic, family & sexual violence counselling)</li>
            <li><strong>Men's Referral Service:</strong> 1300 766 491 | <a href="https://ntv.org.au/mrs" target="_blank" rel="noopener noreferrer">ntv.org.au/mrs</a> (support for men using violence)</li>
          </ul>

          <h3>Aboriginal & Torres Strait Islander Support (Australia)</h3>
          <ul>
            <li><strong>13YARN:</strong> 13 92 76 | <a href="https://www.13yarn.org.au" target="_blank" rel="noopener noreferrer">13yarn.org.au</a> (24/7 crisis support for Aboriginal & Torres Strait Islander peoples)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇺🇸 United States</h2>
          
          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>988 Suicide & Crisis Lifeline:</strong> 988 | <a href="https://988lifeline.org" target="_blank" rel="noopener noreferrer">988lifeline.org</a> (24/7)</li>
            <li><strong>Crisis Text Line:</strong> Text HOME to 741741 | <a href="https://www.crisistextline.org" target="_blank" rel="noopener noreferrer">crisistextline.org</a> (24/7)</li>
            <li><strong>SAMHSA National Helpline:</strong> 1-800-662-4357 | <a href="https://www.samhsa.gov/find-help/national-helpline" target="_blank" rel="noopener noreferrer">samhsa.gov</a> (mental health & substance abuse, 24/7)</li>
          </ul>

          <h3>LGBTQ+ Support (United States)</h3>
          <ul>
            <li><strong>Trevor Project:</strong> 1-866-488-7386 | Text START to 678-678 | <a href="https://www.thetrevorproject.org" target="_blank" rel="noopener noreferrer">thetrevorproject.org</a> (LGBTQ+ youth crisis line, 24/7)</li>
            <li><strong>Trans Lifeline:</strong> 1-877-565-8860 | <a href="https://translifeline.org" target="_blank" rel="noopener noreferrer">translifeline.org</a> (trans peer support)</li>
            <li><strong>LGBT National Hotline:</strong> 1-888-843-4564 | <a href="https://www.lgbthotline.org" target="_blank" rel="noopener noreferrer">lgbthotline.org</a> (Mon-Fri 4pm-midnight ET, Sat 12pm-5pm ET)</li>
          </ul>

          <h3>Domestic Violence & Sexual Assault (United States)</h3>
          <ul>
            <li><strong>National Domestic Violence Hotline:</strong> 1-800-799-7233 | Text START to 88788 | <a href="https://www.thehotline.org" target="_blank" rel="noopener noreferrer">thehotline.org</a> (24/7)</li>
            <li><strong>RAINN (Sexual Assault):</strong> 1-800-656-4673 | <a href="https://www.rainn.org" target="_blank" rel="noopener noreferrer">rainn.org</a> (24/7)</li>
          </ul>

          <h3>Veterans Support (United States)</h3>
          <ul>
            <li><strong>Veterans Crisis Line:</strong> 988 then press 1 | Text 838255 | <a href="https://www.veteranscrisisline.net" target="_blank" rel="noopener noreferrer">veteranscrisisline.net</a> (24/7)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇬🇧 United Kingdom</h2>
          
          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Samaritans:</strong> 116 123 | <a href="https://www.samaritans.org" target="_blank" rel="noopener noreferrer">samaritans.org</a> (24/7 emotional support)</li>
            <li><strong>SHOUT Crisis Text Line:</strong> Text SHOUT to 85258 | <a href="https://giveusashout.org" target="_blank" rel="noopener noreferrer">giveusashout.org</a> (24/7)</li>
            <li><strong>Mind Infoline:</strong> 0300 123 3393 | <a href="https://www.mind.org.uk" target="_blank" rel="noopener noreferrer">mind.org.uk</a> (mental health support, Mon-Fri 9am-6pm)</li>
            <li><strong>Childline:</strong> 0800 1111 | <a href="https://www.childline.org.uk" target="_blank" rel="noopener noreferrer">childline.org.uk</a> (for children & young people, 24/7)</li>
          </ul>

          <h3>LGBTQ+ Support (United Kingdom)</h3>
          <ul>
            <li><strong>Switchboard LGBT+ Helpline:</strong> 0300 330 0630 | <a href="https://switchboard.lgbt" target="_blank" rel="noopener noreferrer">switchboard.lgbt</a> (10am-10pm daily)</li>
            <li><strong>MindLine Trans+:</strong> 0300 330 5468 | <a href="https://mindlinetrans.org.uk" target="_blank" rel="noopener noreferrer">mindlinetrans.org.uk</a> (Mon & Fri 8pm-midnight)</li>
            <li><strong>Mermaids:</strong> 0808 801 0400 | <a href="https://mermaidsuk.org.uk" target="_blank" rel="noopener noreferrer">mermaidsuk.org.uk</a> (trans youth & families, Mon-Fri 9am-9pm)</li>
          </ul>

          <h3>Domestic Violence (United Kingdom)</h3>
          <ul>
            <li><strong>National Domestic Abuse Helpline:</strong> 0808 2000 247 | <a href="https://www.nationaldahelpline.org.uk" target="_blank" rel="noopener noreferrer">nationaldahelpline.org.uk</a> (24/7)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇨🇦 Canada</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Talk Suicide Canada:</strong> 1-833-456-4566 | <a href="https://talksuicide.ca" target="_blank" rel="noopener noreferrer">talksuicide.ca</a> (24/7)</li>
            <li><strong>Crisis Services Canada:</strong> 1-833-456-4566 | Text 45645 | <a href="https://www.crisisservicescanada.ca" target="_blank" rel="noopener noreferrer">crisisservicescanada.ca</a> (24/7)</li>
            <li><strong>Kids Help Phone:</strong> 1-800-668-6868 | Text CONNECT to 686868 | <a href="https://kidshelpphone.ca" target="_blank" rel="noopener noreferrer">kidshelpphone.ca</a> (24/7)</li>
          </ul>

          <h3>LGBTQ+ Support (Canada)</h3>
          <ul>
            <li><strong>Trans Lifeline:</strong> 1-877-330-6366 | <a href="https://translifeline.org" target="_blank" rel="noopener noreferrer">translifeline.org</a></li>
            <li><strong>LGBT Youthline (Ontario):</strong> 1-800-268-9688 | <a href="https://www.youthline.ca" target="_blank" rel="noopener noreferrer">youthline.ca</a></li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇳🇿 New Zealand</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Lifeline Aotearoa:</strong> 0800 543 354 | Text HELP to 4357 | <a href="https://www.lifeline.org.nz" target="_blank" rel="noopener noreferrer">lifeline.org.nz</a> (24/7)</li>
            <li><strong>Suicide Crisis Helpline:</strong> 0508 828 865 (24/7)</li>
            <li><strong>Youthline:</strong> 0800 376 633 | Text 234 | <a href="https://www.youthline.co.nz" target="_blank" rel="noopener noreferrer">youthline.co.nz</a> (24/7)</li>
            <li><strong>Depression Helpline:</strong> 0800 111 757 | Text 4202 | <a href="https://depression.org.nz" target="_blank" rel="noopener noreferrer">depression.org.nz</a> (24/7)</li>
          </ul>

          <h3>LGBTQ+ Support (New Zealand)</h3>
          <ul>
            <li><strong>OUTLine NZ:</strong> 0800 688 5463 | <a href="https://outline.org.nz" target="_blank" rel="noopener noreferrer">outline.org.nz</a> (LGBTIQ+ support, 6pm-9pm daily)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇮🇪 Ireland</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Samaritans:</strong> 116 123 | <a href="https://www.samaritans.org" target="_blank" rel="noopener noreferrer">samaritans.org</a> (24/7)</li>
            <li><strong>Pieta House:</strong> 1800 247 247 | Text HELP to 51444 | <a href="https://www.pieta.ie" target="_blank" rel="noopener noreferrer">pieta.ie</a> (24/7 suicide & self-harm support)</li>
            <li><strong>Childline Ireland:</strong> 1800 66 66 66 | <a href="https://www.childline.ie" target="_blank" rel="noopener noreferrer">childline.ie</a> (24/7)</li>
          </ul>

          <h3>LGBTQ+ Support (Ireland)</h3>
          <ul>
            <li><strong>LGBT Ireland:</strong> 1890 929 539 | <a href="https://www.lgbt.ie" target="_blank" rel="noopener noreferrer">lgbt.ie</a> (Mon-Fri 6:30pm-10pm)</li>
            <li><strong>BeLonG To Youth Services:</strong> (01) 670 6223 | <a href="https://www.belongto.org" target="_blank" rel="noopener noreferrer">belongto.org</a></li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇩🇪 Germany</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>Telefonseelsorge:</strong> 0800 111 0 111 or 0800 111 0 222 | <a href="https://www.telefonseelsorge.de" target="_blank" rel="noopener noreferrer">telefonseelsorge.de</a> (24/7)</li>
            <li><strong>Nummer gegen Kummer (Children):</strong> 116 111 | <a href="https://www.nummergegenkummer.de" target="_blank" rel="noopener noreferrer">nummergegenkummer.de</a> (Mon-Sat 2pm-8pm)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇫🇷 France</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>SOS Amitié:</strong> 09 72 39 40 50 | <a href="https://www.sos-amitie.com" target="_blank" rel="noopener noreferrer">sos-amitie.com</a> (24/7)</li>
            <li><strong>Suicide Écoute:</strong> 01 45 39 40 00 | <a href="https://www.suicide-ecoute.fr" target="_blank" rel="noopener noreferrer">suicide-ecoute.fr</a> (24/7)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇮🇳 India</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>AASRA:</strong> +91 98204 66726 | <a href="http://www.aasra.info" target="_blank" rel="noopener noreferrer">aasra.info</a> (24/7)</li>
            <li><strong>Vandrevala Foundation:</strong> 1860 2662 345 or 1800 2333 330 | <a href="https://www.vandrevalafoundation.com" target="_blank" rel="noopener noreferrer">vandrevalafoundation.com</a> (24/7)</li>
            <li><strong>iCall:</strong> +91 22 2556 3291 | <a href="https://icallhelpline.org" target="_blank" rel="noopener noreferrer">icallhelpline.org</a> (Mon-Sat 8am-10pm)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇯🇵 Japan</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>TELL Lifeline:</strong> 03-5774-0992 | <a href="https://telljp.com" target="_blank" rel="noopener noreferrer">telljp.com</a> (9am-11pm daily, English)</li>
            <li><strong>Inochi no Denwa:</strong> 0570-783-556 | <a href="https://www.inochinodenwa.org" target="_blank" rel="noopener noreferrer">inochinodenwa.org</a> (24/7, Japanese)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🇿🇦 South Africa</h2>

          <h3>General Crisis Support</h3>
          <ul>
            <li><strong>SADAG (South African Depression & Anxiety Group):</strong> 0800 567 567 | <a href="https://www.sadag.org" target="_blank" rel="noopener noreferrer">sadag.org</a> (8am-8pm)</li>
            <li><strong>Suicide Crisis Line:</strong> 0800 567 567 (24/7)</li>
            <li><strong>LifeLine:</strong> 0861 322 322 | <a href="https://www.lifeline.org.za" target="_blank" rel="noopener noreferrer">lifeline.org.za</a> (24/7)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>🌍 International Resources</h2>

          <h3>Global Directories</h3>
          <ul>
            <li><strong>Find a Helpline:</strong> <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a> (comprehensive global directory)</li>
            <li><strong>Befrienders Worldwide:</strong> <a href="https://www.befrienders.org" target="_blank" rel="noopener noreferrer">befrienders.org</a> (suicide prevention centers worldwide)</li>
            <li><strong>International Association for Suicide Prevention:</strong> <a href="https://www.iasp.info/resources/Crisis_Centres" target="_blank" rel="noopener noreferrer">iasp.info</a></li>
          </ul>

          <h3>Online Support</h3>
          <ul>
            <li><strong>7 Cups:</strong> <a href="https://www.7cups.com" target="_blank" rel="noopener noreferrer">7cups.com</a> (free emotional support chat)</li>
            <li><strong>BetterHelp:</strong> <a href="https://www.betterhelp.com" target="_blank" rel="noopener noreferrer">betterhelp.com</a> (online therapy, paid)</li>
            <li><strong>TalkSpace:</strong> <a href="https://www.talkspace.com" target="_blank" rel="noopener noreferrer">talkspace.com</a> (online therapy, paid)</li>
          </ul>
        </section>

        <div className="legal-footer-note">
          <p>
            <strong>Note:</strong> This list is not exhaustive. If you cannot find a helpline for your country, please visit <a href="https://findahelpline.com" target="_blank" rel="noopener noreferrer">findahelpline.com</a> for a comprehensive global directory.
          </p>
          <p>
            If you're experiencing a mental health crisis, please reach out. You are not alone. 💜
          </p>
          <p className="last-updated">
            Last Updated: January 1, 2025
          </p>
        </div>
      </div>

      <div className="legal-nav-footer">
        <Link to="/" className="back-link">← Back to Home</Link>
      </div>
    </div>
  );
}

export default Helplines;

