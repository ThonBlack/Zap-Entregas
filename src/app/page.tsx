import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import LandingNavMenu from "@/components/landing/LandingNavMenu";

export const metadata = {
    title: "Zap Entregas — Gestão inteligente de entregas e motoboys",
    description: "Plataforma completa para gestão de entregas, motoboys e finanças. Rastreamento GPS, dashboard financeiro e app instalável. Feito para lojistas e entregadores.",
    keywords: "Zap Entregas, gestão de entregas, motoboy, delivery, rastreamento GPS, entregas rápidas",
    authors: [{ name: "Epic Corp" }],
    themeColor: "#0a0f0a",
    openGraph: {
        title: "Zap Entregas — Gestão inteligente de entregas",
        description: "Plataforma completa para gestão de entregas, motoboys e finanças.",
        type: "website",
        images: ["/zap-logo.png"],
    },
};

const LANDING_CSS = `
  :root {
    --bg: #060b06;
    --bg-2: #0a120a;
    --bg-3: #0f1a0f;
    --bg-card: #0c160c;
    --text: #f0f5f0;
    --text-2: #9ab89a;
    --text-3: #6a8a6a;
    --text-muted: #445544;
    --green: #22c55e;
    --green-light: #4ade80;
    --emerald: #10b981;
    --border: rgba(34, 197, 94, 0.08);
    --border-hover: rgba(34, 197, 94, 0.25);
    --gradient: linear-gradient(135deg, #22c55e, #10b981);
    --gradient-accent: linear-gradient(135deg, #4ade80, #22c55e, #10b981);
    --font: 'Inter', -apple-system, sans-serif;
    --font-display: 'Space Grotesk', 'Inter', sans-serif;
    --radius: 12px;
    --radius-lg: 20px;
    --transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .landing-root, .landing-root *, .landing-root *::before, .landing-root *::after { margin: 0; padding: 0; box-sizing: border-box; }
  .landing-root { font-family: var(--font); background: var(--bg); color: var(--text); line-height: 1.7; overflow-x: hidden; min-height: 100vh; }
  .landing-root a { color: inherit; text-decoration: none; }
  .landing-root img { max-width: 100%; display: block; }
  .landing-root button { font-family: inherit; border: none; cursor: pointer; background: none; }
  .container { max-width: 1140px; margin: 0 auto; padding: 0 24px; }
  .text-gradient { background: var(--gradient-accent); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .reveal { opacity: 0; transform: translateY(30px); transition: opacity 0.7s ease, transform 0.7s ease; }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; padding: 18px 0; transition: all var(--transition); }
  .nav.scrolled { padding: 10px 0; background: rgba(6, 11, 6, 0.9); backdrop-filter: blur(20px); border-bottom: 1px solid var(--border); }
  .nav-inner { display: flex; align-items: center; justify-content: space-between; }
  .nav-logo { display: flex; align-items: center; gap: 10px; }
  .nav-logo img { width: 36px; height: 36px; }
  .nav-logo span { font-family: var(--font-display); font-size: 1.15rem; font-weight: 700; letter-spacing: 1px; }
  .nav-links { display: flex; gap: 8px; list-style: none; }
  .nav-links a { font-size: 0.88rem; font-weight: 500; color: var(--text-2); padding: 8px 14px; border-radius: 8px; transition: all var(--transition); }
  .nav-links a:hover { color: var(--text); }
  .nav-cta { display: inline-flex; align-items: center; gap: 8px; font-size: 0.88rem; font-weight: 600; color: #fff; background: var(--gradient); padding: 10px 22px; border-radius: 100px; transition: all var(--transition); }
  .nav-cta:hover { box-shadow: 0 4px 24px rgba(34, 197, 94, 0.3); transform: translateY(-1px); }
  .nav-toggle { display: none; flex-direction: column; gap: 5px; padding: 4px; z-index: 10; }
  .nav-toggle span { display: block; width: 22px; height: 2px; background: var(--text); border-radius: 2px; transition: all var(--transition); }
  .mobile-menu { position: fixed; inset: 0; z-index: 99; background: rgba(6, 11, 6, 0.97); backdrop-filter: blur(30px); display: flex; align-items: center; justify-content: center; opacity: 0; visibility: hidden; transition: all 0.5s ease; }
  .mobile-menu.active { opacity: 1; visibility: visible; }
  .mobile-menu ul { list-style: none; text-align: center; display: flex; flex-direction: column; gap: 16px; }
  .mobile-menu a { font-family: var(--font-display); font-size: 1.8rem; font-weight: 600; color: var(--text-2); transition: color var(--transition); }
  .mobile-menu a:hover { color: var(--text); }

  .hero { position: relative; min-height: 100vh; display: flex; align-items: center; padding: 120px 24px 80px; overflow: hidden; }
  .hero-bg { position: absolute; inset: 0; }
  .hero-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(34, 197, 94, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 197, 94, 0.03) 1px, transparent 1px); background-size: 60px 60px; mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%); -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 70%); }
  .hero-glow-1 { position: absolute; width: 500px; height: 500px; border-radius: 50%; background: rgba(34, 197, 94, 0.12); filter: blur(120px); top: -10%; right: -5%; animation: zapFloat 8s ease-in-out infinite; }
  .hero-glow-2 { position: absolute; width: 350px; height: 350px; border-radius: 50%; background: rgba(16, 185, 129, 0.1); filter: blur(100px); bottom: -5%; left: -5%; animation: zapFloat 8s ease-in-out 4s infinite; }
  @keyframes zapFloat { 0%, 100% { transform: translate(0,0); } 50% { transform: translate(20px, -15px); } }
  .hero-content { position: relative; z-index: 2; max-width: 1140px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 60px; align-items: center; }
  .hero-badge { display: inline-flex; align-items: center; gap: 8px; font-size: 0.78rem; font-weight: 600; letter-spacing: 1.5px; text-transform: uppercase; color: var(--green); padding: 8px 18px; border: 1px solid rgba(34, 197, 94, 0.2); border-radius: 100px; background: rgba(34, 197, 94, 0.05); margin-bottom: 28px; }
  .hero-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--green); animation: zapPulse 2s ease infinite; }
  @keyframes zapPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.4); } 50% { box-shadow: 0 0 0 8px rgba(34,197,94,0); } }
  .hero h1 { font-family: var(--font-display); font-size: clamp(2.2rem, 5vw, 3.5rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 24px; }
  .hero-sub { font-size: 1.1rem; color: var(--text-2); max-width: 480px; margin-bottom: 36px; line-height: 1.8; }
  .hero-ctas { display: flex; gap: 14px; flex-wrap: wrap; margin-bottom: 48px; }
  .btn { display: inline-flex; align-items: center; gap: 10px; font-size: 0.95rem; font-weight: 600; padding: 15px 30px; border-radius: var(--radius); transition: all var(--transition); }
  .btn-primary { background: var(--gradient); color: #fff; box-shadow: 0 4px 20px rgba(34, 197, 94, 0.25); }
  .btn-primary:hover { box-shadow: 0 8px 36px rgba(34, 197, 94, 0.4); transform: translateY(-2px); }
  .btn-secondary { border: 1px solid var(--border); color: var(--text); background: rgba(255,255,255,0.02); }
  .btn-secondary:hover { border-color: var(--green); background: rgba(34, 197, 94, 0.05); transform: translateY(-2px); }
  .hero-metrics { display: flex; gap: 36px; }
  .metric { display: flex; flex-direction: column; }
  .metric-value { font-family: var(--font-display); font-size: 1.8rem; font-weight: 700; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
  .metric-label { font-size: 0.78rem; color: var(--text-3); }

  .hero-visual { position: relative; display: flex; justify-content: center; align-items: center; }
  .hero-mockup { position: relative; width: 320px; height: 580px; background: linear-gradient(145deg, var(--bg-3), var(--bg-card)); border: 1px solid var(--border); border-radius: 36px; padding: 12px; box-shadow: 0 40px 80px rgba(0,0,0,0.4), 0 0 60px rgba(34,197,94,0.05); overflow: hidden; }
  .mockup-notch { width: 120px; height: 28px; background: var(--bg); border-radius: 0 0 16px 16px; margin: 0 auto 16px; }
  .mockup-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; margin-bottom: 12px; }
  .mockup-avatar { width: 36px; height: 36px; border-radius: 50%; background: var(--gradient); }
  .mockup-header-text h4 { font-size: 0.85rem; font-weight: 600; }
  .mockup-header-text p { font-size: 0.68rem; color: var(--green); }
  .mockup-stats { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; padding: 0 16px; margin-bottom: 16px; }
  .mockup-stat { background: rgba(34, 197, 94, 0.06); border: 1px solid rgba(34, 197, 94, 0.1); border-radius: 10px; padding: 10px 8px; text-align: center; }
  .mockup-stat strong { display: block; font-size: 1.1rem; color: var(--green); }
  .mockup-stat span { font-size: 0.6rem; color: var(--text-3); }
  .mockup-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 14px 16px; margin: 0 16px 8px; }
  .mockup-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
  .mockup-card-header span:first-child { font-size: 0.78rem; font-weight: 600; }
  .mockup-status { font-size: 0.6rem; padding: 3px 8px; border-radius: 100px; font-weight: 600; }
  .mockup-status.active { background: rgba(34,197,94,0.1); color: var(--green); }
  .mockup-status.pending { background: rgba(250,204,21,0.1); color: #facc15; }
  .mockup-card p { font-size: 0.68rem; color: var(--text-3); }
  .mockup-bar { height: 4px; border-radius: 2px; background: rgba(34,197,94,0.15); margin-top: 8px; }
  .mockup-bar-fill { height: 100%; border-radius: 2px; background: var(--gradient); }
  .hero-float-1 { position: absolute; top: 10%; right: -20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px; animation: zapFloatCard 6s ease-in-out infinite; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
  .hero-float-2 { position: absolute; bottom: 15%; left: -20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 12px 16px; font-size: 0.75rem; display: flex; align-items: center; gap: 8px; animation: zapFloatCard 6s ease-in-out 3s infinite; box-shadow: 0 8px 30px rgba(0,0,0,0.3); }
  @keyframes zapFloatCard { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }

  .section { padding: 120px 0; position: relative; }
  .section-tag { display: inline-block; font-size: 0.78rem; font-weight: 600; letter-spacing: 2.5px; text-transform: uppercase; color: var(--green); margin-bottom: 16px; padding-left: 18px; position: relative; }
  .section-tag::before { content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%); width: 7px; height: 7px; border-radius: 50%; background: var(--gradient); }
  .section-title { font-family: var(--font-display); font-size: clamp(1.8rem, 3.5vw, 2.8rem); font-weight: 700; line-height: 1.2; letter-spacing: -0.02em; margin-bottom: 20px; }
  .section-desc { font-size: 1rem; color: var(--text-2); max-width: 520px; line-height: 1.8; }
  .section-header { margin-bottom: 64px; }

  .features { background: var(--bg-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .features-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .feature-card { padding: 32px 28px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); transition: all var(--transition); }
  .feature-card:hover { border-color: var(--border-hover); transform: translateY(-4px); box-shadow: 0 12px 40px rgba(34,197,94,0.06); }
  .feature-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; border-radius: 10px; background: rgba(34, 197, 94, 0.08); color: var(--green); margin-bottom: 20px; font-size: 1.3rem; }
  .feature-card h3 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; }
  .feature-card p { font-size: 0.88rem; color: var(--text-2); line-height: 1.7; }

  .how { background: var(--bg); }
  .how-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 32px; counter-reset: step; }
  .step-card { position: relative; padding: 36px 28px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); text-align: center; transition: all var(--transition); }
  .step-card:hover { border-color: var(--border-hover); }
  .step-number { font-family: var(--font-display); font-size: 3rem; font-weight: 800; background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; opacity: 0.2; line-height: 1; margin-bottom: 16px; }
  .step-card h3 { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 10px; }
  .step-card p { font-size: 0.88rem; color: var(--text-2); line-height: 1.7; }

  .pricing { background: var(--bg-2); border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
  .pricing-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; max-width: 1100px; margin: 0 auto; }
  .plan-card { padding: 32px 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-lg); transition: all var(--transition); display: flex; flex-direction: column; }
  .plan-card.featured { border-color: var(--green); position: relative; box-shadow: 0 0 40px rgba(34,197,94,0.08); }
  .plan-card.featured::before { content: 'Mais Popular'; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); font-size: 0.7rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #fff; background: var(--gradient); padding: 4px 16px; border-radius: 100px; }
  .plan-name { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; margin-bottom: 8px; }
  .plan-price { font-family: var(--font-display); font-size: 2.4rem; font-weight: 800; margin-bottom: 4px; }
  .plan-price span { font-size: 0.9rem; font-weight: 500; color: var(--text-3); }
  .plan-desc { font-size: 0.82rem; color: var(--text-3); margin-bottom: 24px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }
  .plan-features { list-style: none; display: flex; flex-direction: column; gap: 12px; margin-bottom: 28px; flex-grow: 1; }
  .plan-features li { font-size: 0.88rem; color: var(--text-2); display: flex; align-items: center; gap: 10px; }
  .plan-features li::before { content: '✓'; color: var(--green); font-weight: 700; font-size: 0.8rem; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(34,197,94,0.1); flex-shrink: 0; }
  .plan-btn { display: block; text-align: center; padding: 14px; border-radius: var(--radius); font-weight: 600; font-size: 0.92rem; transition: all var(--transition); }
  .plan-btn.primary { background: var(--gradient); color: #fff; }
  .plan-btn.primary:hover { box-shadow: 0 4px 20px rgba(34,197,94,0.3); }
  .plan-btn.outline { border: 1px solid var(--border); color: var(--text); }
  .plan-btn.outline:hover { border-color: var(--green); }

  .cta-section { background: var(--bg); padding: 100px 0; text-align: center; }
  .cta-box { max-width: 700px; margin: 0 auto; padding: 64px 48px; background: linear-gradient(135deg, rgba(34,197,94,0.06), rgba(16,185,129,0.03)); border: 1px solid var(--border); border-radius: var(--radius-lg); }
  .cta-box h2 { font-family: var(--font-display); font-size: clamp(1.6rem, 3vw, 2.2rem); font-weight: 700; margin-bottom: 16px; }
  .cta-box p { color: var(--text-2); margin-bottom: 32px; max-width: 500px; margin-left: auto; margin-right: auto; }

  .landing-footer { background: var(--bg-2); border-top: 1px solid var(--border); padding: 60px 0 32px; }
  .footer-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 48px; margin-bottom: 48px; }
  .footer-logo { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
  .footer-logo img { width: 32px; height: 32px; }
  .footer-logo span { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; }
  .footer-text { font-size: 0.88rem; color: var(--text-3); line-height: 1.7; max-width: 300px; }
  .footer-col h4 { font-size: 0.78rem; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; color: var(--text); margin-bottom: 16px; }
  .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
  .footer-col a { font-size: 0.88rem; color: var(--text-3); transition: color var(--transition); }
  .footer-col a:hover { color: var(--green); }
  .footer-bottom { padding-top: 24px; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; }
  .footer-bottom p { font-size: 0.78rem; color: var(--text-muted); }
  .footer-epic { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: var(--text-muted); }

  @media (max-width: 1024px) {
    .hero-content { grid-template-columns: 1fr; text-align: center; }
    .hero-sub { margin-left: auto; margin-right: auto; }
    .hero-ctas { justify-content: center; }
    .hero-metrics { justify-content: center; }
    .hero-visual { display: none; }
    .features-grid { grid-template-columns: repeat(2, 1fr); }
    .how-grid { grid-template-columns: 1fr; max-width: 400px; margin: 0 auto; }
    .pricing-grid { grid-template-columns: 1fr; max-width: 380px; margin: 0 auto; }
    .footer-grid { grid-template-columns: 1fr; gap: 32px; }
  }
  @media (max-width: 768px) {
    .nav-links, .nav-cta { display: none; }
    .nav-toggle { display: flex; }
    .features-grid { grid-template-columns: 1fr; }
    .hero-metrics { gap: 24px; flex-wrap: wrap; }
    .footer-bottom { flex-direction: column; gap: 8px; text-align: center; }
  }
  @media (max-width: 480px) {
    .hero-ctas { flex-direction: column; width: 100%; }
    .hero-ctas .btn { width: 100%; justify-content: center; }
    .section { padding: 80px 0; }
    .cta-box { padding: 40px 24px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .landing-root *, .landing-root *::before, .landing-root *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    .reveal { opacity: 1; transform: none; }
  }
`;

export default async function LandingPage() {
    const userId = await getSessionUserId();
    if (userId) redirect("/app");

    return (
        <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
                href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

            <div className="landing-root">
                <LandingNavMenu />

                <section className="hero">
                    <div className="hero-bg">
                        <div className="hero-grid"></div>
                        <div className="hero-glow-1"></div>
                        <div className="hero-glow-2"></div>
                    </div>
                    <div className="hero-content">
                        <div className="hero-text">
                            <div className="hero-badge reveal">
                                <span className="hero-badge-dot"></span>
                                Plataforma de Gestão de Entregas
                            </div>
                            <h1 className="reveal">
                                Suas entregas no<br />
                                <span className="text-gradient">controle total.</span>
                            </h1>
                            <p className="hero-sub reveal">
                                Gerencie entregas, motoboys e finanças em uma única plataforma. Rastreamento em tempo real, dashboard financeiro e app instalável no celular.
                            </p>
                            <div className="hero-ctas reveal">
                                <a href="/register" className="btn btn-primary">
                                    <span>Criar conta grátis</span>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M5 12h14M12 5l7 7-7 7" />
                                    </svg>
                                </a>
                                <a href="/login" className="btn btn-secondary">
                                    <span>Acessar plataforma</span>
                                </a>
                            </div>
                            <div className="hero-metrics reveal">
                                <div className="metric">
                                    <span className="metric-value">GPS</span>
                                    <span className="metric-label">Rastreamento em tempo real</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-value">PWA</span>
                                    <span className="metric-label">Instale no celular</span>
                                </div>
                                <div className="metric">
                                    <span className="metric-value">24/7</span>
                                    <span className="metric-label">Sempre disponível</span>
                                </div>
                            </div>
                        </div>
                        <div className="hero-visual reveal">
                            <div className="hero-mockup">
                                <div className="mockup-notch"></div>
                                <div className="mockup-header">
                                    <div className="mockup-avatar"></div>
                                    <div className="mockup-header-text">
                                        <h4>Olá, Lojista</h4>
                                        <p>Painel ativo</p>
                                    </div>
                                </div>
                                <div className="mockup-stats">
                                    <div className="mockup-stat"><strong>12</strong><span>Pendentes</span></div>
                                    <div className="mockup-stat"><strong>5</strong><span>Em rota</span></div>
                                    <div className="mockup-stat"><strong>47</strong><span>Entregues</span></div>
                                </div>
                                <div className="mockup-card">
                                    <div className="mockup-card-header">
                                        <span>Pedido #1042</span>
                                        <span className="mockup-status active">Em rota</span>
                                    </div>
                                    <p>Rua das Flores, 230 • Motoboy: Carlos</p>
                                    <div className="mockup-bar"><div className="mockup-bar-fill" style={{ width: "72%" }}></div></div>
                                </div>
                                <div className="mockup-card">
                                    <div className="mockup-card-header">
                                        <span>Pedido #1041</span>
                                        <span className="mockup-status pending">Pendente</span>
                                    </div>
                                    <p>Av. Brasil, 89 • Aguardando motoboy</p>
                                    <div className="mockup-bar"><div className="mockup-bar-fill" style={{ width: "15%" }}></div></div>
                                </div>
                            </div>
                            <div className="hero-float-1">
                                <span style={{ fontSize: "1.2rem" }}>📍</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>GPS ativo</div>
                                    <div style={{ color: "var(--green)", fontSize: "0.68rem" }}>Rastreando 5 motoboys</div>
                                </div>
                            </div>
                            <div className="hero-float-2">
                                <span style={{ fontSize: "1.2rem" }}>💰</span>
                                <div>
                                    <div style={{ fontWeight: 600 }}>R$ 2.340</div>
                                    <div style={{ color: "var(--text-3)", fontSize: "0.68rem" }}>Faturamento hoje</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="features" className="section features">
                    <div className="container">
                        <div className="section-header reveal">
                            <span className="section-tag">Funcionalidades</span>
                            <h2 className="section-title">
                                Tudo que seu delivery<br />
                                precisa em <span className="text-gradient">um só lugar</span>
                            </h2>
                            <p className="section-desc">
                                Desenvolvido por quem entende a operação real de entregas. Cada funcionalidade resolve um problema concreto.
                            </p>
                        </div>
                        <div className="features-grid">
                            {[
                                { icon: "📍", title: "Rastreamento GPS", text: "Acompanhe seus motoboys em tempo real no mapa. Saiba onde cada entrega está e estime o tempo de chegada." },
                                { icon: "📊", title: "Dashboard Financeiro", text: "Controle receitas, despesas e comissões em um painel completo. Relatórios automáticos para tomada de decisão." },
                                { icon: "🏍️", title: "Gestão de Motoboys", text: "Cadastre, avalie e gerencie sua equipe. Sistema de rating, níveis gamificados e controle de performance." },
                                { icon: "📱", title: "App Instalável (PWA)", text: "Instale direto no celular sem precisar de loja. Funciona como app nativo com acesso rápido e notificações." },
                                { icon: "🗺️", title: "Otimização de Rotas", text: "Organize entregas por proximidade. Reduza tempo de deslocamento e aumente a eficiência da sua operação." },
                                { icon: "🔒", title: "Segurança 2FA", text: "Autenticação em dois fatores para proteção total. Seus dados e os dados dos seus clientes sempre seguros." },
                            ].map((f) => (
                                <div key={f.title} className="feature-card reveal">
                                    <div className="feature-icon">{f.icon}</div>
                                    <h3>{f.title}</h3>
                                    <p>{f.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="how" className="section how">
                    <div className="container">
                        <div className="section-header reveal" style={{ textAlign: "center" }}>
                            <span className="section-tag">Como Funciona</span>
                            <h2 className="section-title">
                                Operando em <span className="text-gradient">3 passos</span>
                            </h2>
                        </div>
                        <div className="how-grid">
                            {[
                                { n: "01", title: "Crie sua conta", text: "Cadastre-se como lojista ou motoboy em menos de 1 minuto. Sem burocracia, sem cartão de crédito." },
                                { n: "02", title: "Configure sua operação", text: "Cadastre motoboys, defina remunerações e personalize seu painel. Tudo intuitivo e rápido." },
                                { n: "03", title: "Gerencie e escale", text: "Crie entregas, acompanhe em tempo real e controle suas finanças. Pronto para crescer junto com você." },
                            ].map((s) => (
                                <div key={s.n} className="step-card reveal">
                                    <div className="step-number">{s.n}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                <section id="pricing" className="section pricing">
                    <div className="container">
                        <div className="section-header reveal" style={{ textAlign: "center" }}>
                            <span className="section-tag">Planos</span>
                            <h2 className="section-title">
                                Escolha o plano ideal<br />
                                para sua <span className="text-gradient">operação</span>
                            </h2>
                            <p className="section-desc" style={{ margin: "0 auto" }}>
                                Comece grátis e evolua conforme sua demanda cresce.
                            </p>
                        </div>
                        <div className="pricing-grid">
                            <div className="plan-card reveal">
                                <div className="plan-name">Grátis</div>
                                <div className="plan-price">R$ 0 <span>/mês</span></div>
                                <div className="plan-desc">Para começar</div>
                                <ul className="plan-features">
                                    <li>Até 30 entregas/mês</li>
                                    <li>1 motoboy</li>
                                    <li>Dashboard básico</li>
                                    <li>App instalável (PWA)</li>
                                </ul>
                                <a href="/register" className="plan-btn outline">Começar grátis</a>
                            </div>
                            <div className="plan-card reveal">
                                <div className="plan-name">Basic</div>
                                <div className="plan-price">R$ 19<span>,90/mês</span></div>
                                <div className="plan-desc">Operação pequena</div>
                                <ul className="plan-features">
                                    <li>Até 150 entregas/mês</li>
                                    <li>3 motoboys</li>
                                    <li>Dashboard financeiro</li>
                                    <li>Suporte por email</li>
                                </ul>
                                <a href="/register" className="plan-btn outline">Assinar Basic</a>
                            </div>
                            <div className="plan-card featured reveal">
                                <div className="plan-name">Pro</div>
                                <div className="plan-price">R$ 49<span>,90/mês</span></div>
                                <div className="plan-desc">Para crescer</div>
                                <ul className="plan-features">
                                    <li>Até 500 entregas/mês</li>
                                    <li>10 motoboys</li>
                                    <li>Rastreamento GPS</li>
                                    <li>Otimização de rotas</li>
                                    <li>Relatórios avançados</li>
                                    <li>Suporte prioritário</li>
                                </ul>
                                <a href="/register" className="plan-btn primary">Começar agora</a>
                            </div>
                            <div className="plan-card reveal">
                                <div className="plan-name">Growth</div>
                                <div className="plan-price">R$ 79<span>,90/mês</span></div>
                                <div className="plan-desc">Operação madura</div>
                                <ul className="plan-features">
                                    <li>Até 1.500 entregas/mês</li>
                                    <li>25 motoboys</li>
                                    <li>Tudo do plano Pro</li>
                                    <li>API de integração PDV</li>
                                    <li>Multi-unidades</li>
                                </ul>
                                <a href="/register" className="plan-btn outline">Assinar Growth</a>
                            </div>
                            <div className="plan-card reveal">
                                <div className="plan-name">Enterprise</div>
                                <div className="plan-price">Sob consulta</div>
                                <div className="plan-desc">Grande porte</div>
                                <ul className="plan-features">
                                    <li>Entregas ilimitadas</li>
                                    <li>Motoboys ilimitados</li>
                                    <li>SLA personalizado</li>
                                    <li>Gerente de conta dedicado</li>
                                    <li>Onboarding assistido</li>
                                </ul>
                                <a href="/register" className="plan-btn outline">Fale conosco</a>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="cta-section">
                    <div className="container">
                        <div className="cta-box reveal">
                            <h2>
                                Pronto para profissionalizar<br />
                                suas <span className="text-gradient">entregas</span>?
                            </h2>
                            <p>Junte-se a lojistas e motoboys que já otimizam sua operação com o Zap Entregas.</p>
                            <a href="/register" className="btn btn-primary">
                                <span>Criar conta grátis</span>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M5 12h14M12 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </section>

                <footer className="landing-footer">
                    <div className="container">
                        <div className="footer-grid">
                            <div>
                                <div className="footer-logo">
                                    <img src="/zap-logo.png" alt="Zap Entregas" />
                                    <span>Zap <span className="text-gradient">Entregas</span></span>
                                </div>
                                <p className="footer-text">
                                    Gestão inteligente de entregas e motoboys. Feito para quem precisa de controle, velocidade e resultado.
                                </p>
                            </div>
                            <div className="footer-col">
                                <h4>Plataforma</h4>
                                <ul>
                                    <li><a href="#features">Funcionalidades</a></li>
                                    <li><a href="#pricing">Planos</a></li>
                                    <li><a href="/login">Acessar</a></li>
                                    <li><a href="/register">Cadastro</a></li>
                                </ul>
                            </div>
                            <div className="footer-col">
                                <h4>Ecossistema</h4>
                                <ul>
                                    <li><a href="https://epiccorp.duckdns.org" target="_blank" rel="noopener">Epic Corp</a></li>
                                    <li><a href="https://epicsuit.duckdns.org" target="_blank" rel="noopener">EpicSuit</a></li>
                                    <li><a href="https://vaporfume.shop" target="_blank" rel="noopener">Vapor Fumê</a></li>
                                </ul>
                            </div>
                        </div>
                        <div className="footer-bottom">
                            <p>© 2026 Zap Entregas. Todos os direitos reservados.</p>
                            <div className="footer-epic">
                                <span>Uma empresa</span>
                                <a href="https://epiccorp.duckdns.org" target="_blank" rel="noopener" style={{ color: "var(--text-2)", fontWeight: 600 }}>Epic Corp</a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
